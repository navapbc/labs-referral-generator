import logging
from pprint import pformat
from typing import Generator

import hayhooks
from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from haystack.components.generators.chat import OpenAIChatGenerator
from haystack.dataclasses.chat_message import ChatMessage

from src.common import components, haystack_utils, phoenix_utils

logger = logging.getLogger(__name__)
tracer = phoenix_utils.tracer_provider.get_tracer(__name__)

system_msg = "This is a sample pipeline, it echoes back the system and user messages provided"


class PipelineWrapper(BasePipelineWrapper):
    name = "sample_pipeline"

    def setup(self) -> None:
        prompt_builder = ChatPromptBuilder()
        llm = OpenAIChatGenerator(model="gpt-4o-mini")

        self.pipeline = Pipeline()
        self.pipeline.add_component("echo_component", components.EchoNode())
        self.pipeline.add_component("echo_component2", components.EchoNode())
        self.pipeline.add_component("logger", components.ReadableLogger())

        self.pipeline.add_component("prompt_builder", prompt_builder)
        self.pipeline.add_component("llm", llm)

        self.pipeline.connect("echo_component", "logger")
        self.pipeline.connect("echo_component2", "logger")
        self.pipeline.connect("prompt_builder.prompt", "llm.messages")
        self.pipeline.connect("prompt_builder.prompt", "logger")
        self.pipeline.connect("llm", "logger")

        self.runner = haystack_utils.TracedPipelineRunner(self.name, self.pipeline)

    # Called for the `sample_pipeline/run` endpoint
    def run_api(self, question: str) -> dict:
        """Sample pipeline that uses Haystack's OpenAI component; useful for comparison against our OpenAIWebSearchGenerator component."""
        user_id = "someone@example.com"
        messages = [
            ChatMessage.from_system(system_msg),
            ChatMessage.from_user(question),
        ]
        location = "Berlin"
        pipeline_run_args = self.create_pipeline_args(location, messages) | {
            "logger": {
                "messages_list": [{"question": question}],
            },
            "echo_component": {"prompt": messages, "history": []},
        }
        response = self.runner.return_response(
            pipeline_run_args,
            user_id=user_id,
            metadata={"user_id": user_id},
            include_outputs_from={"echo_component", "echo_component2"},
            input_=question,
            extract_output=lambda result: result["echo_component"]["full_prompt"][-1].texts,
        )
        logger.info("Results: %s", pformat(response))
        return response

    # https://docs.haystack.deepset.ai/docs/hayhooks#openai-compatibility
    # Called for the `{pipeline_name}/chat`, `/chat/completions`, or `/v1/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Generator:
        logger.info("Running streaming LLM with model: %s, messages: %s", model, messages)
        question = hayhooks.get_last_user_message(messages)
        logger.info("Question: %s", question)

        location = "Berlin"
        chat_messages = haystack_utils.to_chat_messages(messages)
        chat_messages.append(ChatMessage.from_user("Write a summary sentence about {{location}}"))

        pipeline_run_args = self.create_pipeline_args(location, chat_messages) | {
            "logger": {
                "messages_list": chat_messages,
            },
            "echo_component": {
                "prompt": [ChatMessage.from_user(question)],
                "history": chat_messages[:-1],
            },
        }

        user_id = "someone@example.com"
        return self.runner.stream_response(
            pipeline_run_args, user_id=user_id, metadata={"user_id": user_id}, input_=question
        )

    def create_pipeline_args(self, location: str, messages: list[ChatMessage]) -> dict:
        "Common args for both run_api and run_chat_completion"
        return {
            "echo_component2": {"prompt": messages, "history": []},
            "prompt_builder": {"template_variables": {"location": location}, "template": messages},
        }
