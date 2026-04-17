import json
import logging
import uuid
from enum import Enum
from pprint import pformat
from typing import Generator, Optional

import httpx
from fastapi import HTTPException
from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from haystack.components.converters import OutputAdapter
from haystack.components.embedders import SentenceTransformersTextEmbedder
from haystack_integrations.components.retrievers.chroma import ChromaEmbeddingRetriever
from pydantic import BaseModel

from src.app_config import config
from src.common import components, haystack_utils

logger = logging.getLogger(__name__)


class ReferralType(str, Enum):
    EXTERNAL = "external"
    INTERNAL = "internal"
    GOVERNMENT = "government"


class Resource(BaseModel):
    name: str
    addresses: list[str]
    phones: list[str]
    emails: list[str]
    website: Optional[str] = None
    description: str
    justification: str
    referral_type: Optional[ReferralType] = None


class ResourceList(BaseModel):
    resources: list[Resource]


response_schema = """
{
    "resources": {
        "name": string;
        "addresses": string[];
        "phones": string[];
        "emails": string[];
        "website"?: string | null;
        "description": string;
        "justification": string;
        "referral_type"?: "external" | "internal" | "government" | null;
    }[];
}
"""


def extract_output(result: dict) -> list | str:
    try:
        resp_obj = json.loads(result["llm"]["replies"][-1].text)
        return [r["name"] for r in resp_obj["resources"]]
    except (KeyError, IndexError, json.JSONDecodeError):
        return result["llm"]["replies"][-1].text


def shorten_output(response_text: str) -> str:
    try:
        resp_obj = json.loads(response_text)
        return str([r["name"] for r in resp_obj["resources"]])
    except (KeyError, IndexError, json.JSONDecodeError):
        return response_text


class PipelineWrapper(BasePipelineWrapper):
    name = "generate_referrals_rag"

    def setup(self) -> None:
        self.pipeline = self._create_pipeline()
        self.runner = haystack_utils.TracedPipelineRunner(self.name, self.pipeline)

    def _create_pipeline(self) -> Pipeline:
        # Do not rely on max_runs_per_component strictly, i.e., a component may run max_runs_per_component+1 times.
        # The component_visits counter for max_runs_per_component is reset with each call to pipeline.run()
        pipeline = Pipeline(max_runs_per_component=3)

        # Replace LoadSupports() with retrieval from vector DB
        pipeline.add_component(
            "query_embedder", SentenceTransformersTextEmbedder(model=config.rag_embedding_model)
        )
        pipeline.add_component(
            # The DocumentStore is populated by rag_utils.populate_vector_db(), called in gunicorn.conf.py
            "retriever",
            ChromaEmbeddingRetriever(config.chroma_document_store()),
        )
        pipeline.add_component(
            "output_adapter",
            # https://docs.haystack.deepset.ai/docs/outputadapter
            # Use Jinja template to extract content field from documents and return as list of strings,
            # which is used as input to the prompt builder as supports
            OutputAdapter(
                template="{{ documents | map(attribute='content') | list }}",
                output_type=list,
            ),
        )
        pipeline.add_component("document_capture", components.DocumentCapture())

        pipeline.connect("query_embedder.embedding", "retriever.query_embedding")
        pipeline.connect("retriever.documents", "document_capture.documents")
        pipeline.connect("document_capture.documents", "output_adapter")

        pipeline.add_component(
            "prompt_builder",
            ChatPromptBuilder(
                # List all variables (required and optional) that could be used in the prompt template.
                # Don't include "template" as it is implicitly required by ChatPromptBuilder
                variables=[
                    "query",
                    "supports",
                    "response_json",
                    "error_message",
                    "invalid_replies",
                ],
            ),
        )
        pipeline.add_component("llm", components.OpenAIWebSearchGenerator())
        pipeline.add_component("output_validator", components.LlmOutputValidator(ResourceList))
        pipeline.add_component("save_result", components.SaveResult())

        pipeline.connect("output_adapter.output", "prompt_builder.supports")
        pipeline.connect("prompt_builder", "llm.messages")
        pipeline.connect("llm.replies", "output_validator")
        pipeline.connect("output_validator.valid_replies", "save_result.replies")

        # Re-trigger the prompt builder with error_message and invalid_replies
        pipeline.connect("output_validator.error_message", "prompt_builder.error_message")
        pipeline.connect("output_validator.invalid_replies", "prompt_builder.invalid_replies")

        pipeline.add_component("logger", components.ReadableLogger())
        pipeline.connect("output_validator.valid_replies", "logger")

        # pipeline.draw(path="generate_referrals_rag.png")
        return pipeline

    # This function is called for the `generate_referrals_rag/run` API endpoint (non-streaming)
    def run_api(
        self,
        query: str,
        user_email: str,
        prompt_version_id: str = "",
        suffix: str = "centraltx",
        region: str | None = None,
    ) -> dict:
        """
        Generate referrals based on given query using RAG.
        The suffix is used for prompt selection. The suffix defaults to "centraltx".
        The region is used for filtering retrieved documents from the vector DB. The region defaults to suffix.

        For internal experimentation, suffix could be "centraltx-ryan" and the region="centraltx".
        """

        if not region:
            region = suffix

        pipeline_run_args = self.create_pipeline_args(
            query,
            user_email,
            suffix=suffix,
            region=region,
            prompt_version_id=prompt_version_id,
        )

        response = self.runner.return_response(
            pipeline_run_args,
            user_id=user_email,
            metadata={"user_id": user_email},
            include_outputs_from={"llm", "save_result", "retriever"},
            input_=query,
            extract_output=extract_output,
            parent_span_name_suffix=suffix,
        )
        logger.debug("Results: %s", pformat(response, width=160))
        return response

    def create_pipeline_args(
        self,
        query: str,
        user_email: str,
        *,
        suffix: str,
        region: str,
        prompt_version_id: str = "",
        llm_model: str | None = None,
        reasoning_effort: str | None = None,
        streaming: bool = False,
        result_id: str | None = None,
    ) -> dict:
        """Create pipeline run arguments with optional overrides for model, reasoning effort, and streaming."""
        assert suffix, "suffix is required"
        assert region, "region is required"

        try:
            prompt_template = haystack_utils.get_phoenix_prompt(
                "generate_referrals", prompt_version_id=prompt_version_id, suffix=suffix
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=422,
                detail=f"The requested prompt version '{prompt_version_id}' with suffix '{suffix}' could not be retrieved",
            ) from e

        args = {
            "logger": {
                "messages_list": [{"query": query, "user_email": user_email}],
            },
            "prompt_builder": {
                "template": prompt_template,
                "query": query,
                "response_json": response_schema,
            },
            "llm": {
                "model": llm_model or config.generate_referrals_rag_model_version,
                "reasoning_effort": reasoning_effort
                or config.generate_referrals_rag_reasoning_level,
                "streaming": streaming,
                "temperature": config.generate_referrals_rag_temperature,
            },
            # For querying RAG DB
            "query_embedder": {"text": query},
            "retriever": {
                "top_k": config.retrieval_top_k,
                "filters": {"field": "region", "operator": "==", "value": region},
            },
        }
        if result_id:
            args["save_result"] = {"result_id": result_id}
            args["document_capture"] = {"result_id": result_id}
        return args

    # https://docs.haystack.deepset.ai/docs/hayhooks#openai-compatibility
    # This function is called for the `{pipeline_name}/chat`, `/chat/completions`, or `/v1/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Generator:
        # Note: 'model' parameter is the pipeline name, not the LLM model
        assert model == self.name, f"Unexpected model/pipeline name: {model}"

        # Extract custom parameters from the body
        query = body.get("query", "")
        user_email = body.get("user_email", "")
        suffix = body.get("suffix", "centraltx")
        region = body.get("region", suffix)

        if not query:
            raise ValueError("query parameter is required")

        if not user_email:
            raise ValueError("user_email parameter is required")

        # Generate result_id upfront to pass to both SaveResult and DocumentCapture via pipeline args
        result_id = str(uuid.uuid4())
        pipeline_run_args = self.create_pipeline_args(
            query,
            user_email,
            suffix=suffix,
            region=region,
            prompt_version_id=body.get("prompt_version_id", ""),
            llm_model=body.get("llm_model", None),
            reasoning_effort=body.get("reasoning_effort", None),
            streaming=True,
            result_id=result_id,
        )

        logger.info("Streaming referrals: %s", pipeline_run_args)
        return self.runner.stream_response(
            pipeline_run_args,
            user_id=user_email,
            metadata={"user_id": user_email},
            input_=query,
            shorten_output=shorten_output,
            parent_span_name_suffix=suffix,
            generator_hook=haystack_utils.create_result_id_hook(
                self.pipeline,
                result_id,
                pop_documents_fn=lambda: {"documents": components.DocumentCapture.pop(result_id)},
            ),
            # No-op if the hook already ran (pop returns [] for missing keys).
            # Ensures the DocumentCapture entry is always removed even when the pipeline
            # raises before the hook executes.
            cleanup_fn=lambda: components.DocumentCapture.pop(result_id),
        )
