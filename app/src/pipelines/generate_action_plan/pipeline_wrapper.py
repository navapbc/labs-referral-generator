import logging
import uuid
from pprint import pformat
from typing import Generator

from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from pydantic import BaseModel

from src.app_config import config
from src.common import haystack_utils
from src.common.components import (
    LlmOutputValidator,
    OpenAIWebSearchGenerator,
    ReadableLogger,
    SaveResult,
)
from src.pipelines.generate_referrals_rag.pipeline_wrapper import Resource

logger = logging.getLogger(__name__)


class ActionPlan(BaseModel):
    title: str
    summary: str
    content: str


action_plan_as_json = """
{
    "title": string,
    "summary": string,
    "content": string
}
"""


class PipelineWrapper(BasePipelineWrapper):
    name = "generate_action_plan"

    def setup(self) -> None:
        pipeline = Pipeline()
        pipeline.add_component("llm", OpenAIWebSearchGenerator())

        pipeline.add_component(
            instance=ChatPromptBuilder(
                variables=["resources", "action_plan_json", "user_query", "context_documents"],
            ),
            name="prompt_builder",
        )
        pipeline.add_component("output_validator", LlmOutputValidator(ActionPlan))
        pipeline.add_component("save_result", SaveResult())

        pipeline.connect("prompt_builder", "llm.messages")
        pipeline.connect("llm.replies", "output_validator")
        pipeline.connect("output_validator.valid_replies", "save_result.replies")

        pipeline.add_component("logger", ReadableLogger())
        pipeline.connect("llm", "logger")

        self.pipeline = pipeline
        self.runner = haystack_utils.TracedPipelineRunner(self.name, self.pipeline)

    # Called for the `generate-action-plan/run` endpoint
    def run_api(
        self,
        resources: list[Resource] | list[dict],
        user_email: str,
        user_query: str,
        context_documents: list[str] | None = None,
    ) -> dict:
        """
        Generate an action plan based on the given resources.
        The user query provides more context to the generation process.
        The optional context_documents are RAG source documents from the referrals pipeline,
        passed as additional context to the LLM prompt.
        """
        resource_objects = get_resources(resources)
        pipeline_run_args = self.create_pipeline_args(
            user_email,
            resource_objects,
            user_query,
            context_documents=context_documents,
        )
        response = self.runner.return_response(
            pipeline_run_args,
            user_id=user_email,
            metadata={"user_id": user_email},
            include_outputs_from={"llm", "save_result"},
            input_=[r.name for r in resource_objects],
            extract_output=lambda response: response["llm"]["replies"][0]._content[0].text,
        )
        logger.debug("Results: %s", pformat(response, width=160))

        return {
            "response": response["llm"]["replies"][0]._content[0].text,
            "save_result": response["save_result"],
        }

    def create_pipeline_args(
        self,
        user_email: str,
        resource_objects: list[Resource],
        user_query: str,
        *,
        context_documents: list[str] | None = None,
        llm_model: str | None = None,
        reasoning_effort: str | None = None,
        streaming: bool = False,
    ) -> dict:
        prompt_template = haystack_utils.get_phoenix_prompt("generate_action_plan")
        return {
            "logger": {
                "messages_list": [
                    {"resource_count": len(resource_objects), "user_email": user_email}
                ],
            },
            "prompt_builder": {
                "template": prompt_template,
                "resources": format_resources(resource_objects),
                "action_plan_json": action_plan_as_json,
                "user_query": user_query,
                "context_documents": format_context_documents(context_documents),
            },
            "llm": {
                "model": llm_model or config.generate_action_plan_model_version,
                "reasoning_effort": reasoning_effort or config.generate_action_plan_reasoning_level,
                "streaming": streaming,
                "temperature": config.generate_action_plan_temperature,
            },
        }

    # https://docs.haystack.deepset.ai/docs/hayhooks#openai-compatibility
    # Called for the `{pipeline_name}/chat`, `/chat/completions`, or `/v1/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Generator:
        # Note: 'model' parameter is the pipeline name, not the LLM model
        assert model == self.name, f"Unexpected model/pipeline name: {model}"

        # Extract custom parameters from the body
        resources = body.get("resources", [])
        user_email = body.get("user_email", "")
        user_query = body.get("user_query", "")
        context_documents = body.get("context_documents", None)

        if not resources:
            raise ValueError("resources parameter is required")
        if not user_email:
            raise ValueError("user_email parameter is required")

        resource_objects = get_resources(resources)
        pipeline_run_args = self.create_pipeline_args(
            user_email,
            resource_objects,
            user_query,
            context_documents=context_documents,
            llm_model=body.get("llm_model", None),
            reasoning_effort=body.get("reasoning_effort", None),
            streaming=True,
        )

        # Generate result_id upfront to pass to both SaveResult and the hook
        result_id = str(uuid.uuid4())
        pipeline_run_args["save_result"] = {"result_id": result_id}

        logger.info("Streaming action plan: %s", pipeline_run_args)
        return self.runner.stream_response(
            pipeline_run_args,
            user_id=user_email,
            metadata={"user_id": user_email},
            input_=[r.name for r in resource_objects],
            generator_hook=haystack_utils.create_result_id_hook(self.pipeline, result_id),
        )


def get_resources(resources: list[Resource] | list[dict]) -> list[Resource]:
    """Ensure we have a list of Resource objects."""
    if not resources:
        return []
    if isinstance(resources[0], Resource):
        return resources  # type: ignore[return-value]
    return [Resource(**res) for res in resources]  # type: ignore[arg-type]


def format_context_documents(documents: list[str] | None) -> str:
    """Format a list of retrieved RAG documents into a readable string for the LLM prompt."""
    if not documents:
        return ""
    doc_lines = "\n\n".join(f"- {doc}" for doc in documents)
    return f"Source Documents:\n{doc_lines}"


def format_resources(resources: list[Resource]) -> str:
    """Format a list of Resource objects into a readable string."""
    formatted_resources = []
    for resource in resources:
        resource_str = f"Name: {resource.name}\n"
        if resource.description:
            resource_str += f"- Description: {resource.description}\n"
        if resource.justification:
            resource_str += f"- Justification: {resource.justification}\n"
        if resource.addresses:
            resource_str += f"- Addresses: {', '.join(resource.addresses)}\n"
        if resource.phones:
            resource_str += f"- Phones: {', '.join(resource.phones)}\n"
        if resource.emails:
            resource_str += f"- Emails: {', '.join(resource.emails)}\n"
        if resource.website:
            resource_str += f"- Website: {resource.website}\n"
        formatted_resources.append(resource_str)
    return "\n".join(formatted_resources)
