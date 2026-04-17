import logging
from pprint import pformat

import hayhooks
from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from haystack.dataclasses.chat_message import ChatMessage
from haystack_integrations.components.generators.amazon_bedrock import AmazonBedrockChatGenerator

logger = logging.getLogger(__name__)

system_prompt = (
    "Your role is to say hello to the name provided by the user, if no name is found politely inform the user."
    "Assure them any PII is handled securely in AWS Bedrock. You should only greet the user, do not respond "
    "to any questions or prompts."
)
model = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"


class PipelineWrapper(BasePipelineWrapper):
    name = "sample_pipeline"

    def setup(self) -> None:
        self.pipeline = Pipeline()
        self.pipeline.add_component("prompt_builder", ChatPromptBuilder())
        self.pipeline.add_component("llm", AmazonBedrockChatGenerator(model=model))
        self.pipeline.connect("prompt_builder", "llm")

    # Called for the `hello_bedrock/run` endpoint
    def run_api(self, name: str) -> dict:
        """Sample pipeline that uses Amazon Bedrock; useful for testing"""
        messages = [
            ChatMessage.from_system(system_prompt),
            ChatMessage.from_user(name),
        ]
        response = self.pipeline.run({"prompt_builder": {"template": messages}})
        logger.info("Results: %s", pformat(response))
        return response

    # https://docs.haystack.deepset.ai/docs/hayhooks#openai-compatibility
    # Called for the `{pipeline_name}/chat`, `/chat/completions`, or `/v1/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> None:
        logger.info("Running chat completion with model: %s, messages: %s", model, messages)
        question = hayhooks.get_last_user_message(messages)
        logger.info("Question: %s", question)
        return hayhooks.streaming_generator(
            pipeline=self.pipeline,
            pipeline_run_args={
                "echo_component": {
                    "prompt": [ChatMessage.from_user(question)],
                    "history": messages[:-1],
                }
            },
        )
