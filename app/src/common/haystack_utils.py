import json
import logging
from typing import Any, Callable, Generator, Sequence

import hayhooks
from fastapi import HTTPException
from haystack import Pipeline
from haystack.core.errors import PipelineRuntimeError
from haystack.dataclasses.chat_message import ChatMessage
from haystack.dataclasses.streaming_chunk import StreamingChunk
from openinference.instrumentation import using_attributes
from opentelemetry.trace import Span
from opentelemetry.trace.status import Status, StatusCode
from phoenix.client.__generated__ import v1

from src.common import phoenix_utils
from src.common.components import SaveResult


def get_phoenix_prompt(
    prompt_name: str, prompt_version_id: str = "", suffix: str = ""
) -> list[ChatMessage]:
    full_prompt_name = f"{prompt_name}_{suffix}" if suffix else prompt_name
    prompt_ver = phoenix_utils.get_prompt_template(full_prompt_name, prompt_version_id)
    return to_chat_messages(prompt_ver._template["messages"])


def to_chat_messages(
    msg_list: Sequence[str | dict | v1.PromptMessage | ChatMessage],
) -> list[ChatMessage]:
    """Convert a list of dicts or Phoenix PromptMessage to a list of Haystack ChatMessage."""
    messages = []
    for msg in msg_list:
        if isinstance(msg, ChatMessage):
            messages.append(msg)
            continue
        elif not isinstance(msg, dict):  # PromptMessage is a TypedDict
            raise ValueError(f"Expected dict or ChatMessage, got {type(msg)}")

        role = msg["role"]
        content = msg["content"]

        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            assert (
                len(content) == 1
            ), f"Expected single content, got {len(content)} items: {content}"
            assert content[0]["type"] == "text", f"Expected text content, got {content[0]['type']}"
            assert "text" in content[0], f"Expected 'text' in content[0], got {content[0]}"
            text = content[0]["text"]
        else:
            raise ValueError(f"Unexpected content type: {type(content)} for message {msg}")

        if role == "system":
            assert isinstance(text, str), f"Expected string, got {type(text)}"
            chat_msg = ChatMessage.from_system(text)
        elif role == "user":
            assert isinstance(text, str), f"Expected string, got {type(text)}"
            chat_msg = ChatMessage.from_user(text)
        elif role == "assistant":
            assert isinstance(text, str), f"Expected string, got {type(text)}"
            chat_msg = ChatMessage.from_assistant(text)
        else:
            raise ValueError(f"Unexpected role: {role} for message {msg}")
        messages.append(chat_msg)

    return messages


def create_result_id_hook(
    pipeline: Pipeline,
    result_id: str,
    pop_documents_fn: Callable[[], dict] | None = None,
) -> Callable[[dict], Generator]:
    """Creates a generator hook that yields the result_id as the last chunk in a streaming response,
    i.e., TracedPipelineRunner.stream_response() calls a generator_hook() after pipeline.run() completes.

    This hook is specific to pipelines that use the SaveResult component and need to
    return the result_id to the frontend for caching/reference.

    Args:
        pipeline: The Haystack pipeline to check for SaveResult component
        result_id: The result_id that will be used by SaveResult and yielded to frontend
        pop_documents_fn: Optional callable that retrieves and clears captured documents,
            returning them as a dict to merge into the yielded JSON

    Raises:
        ValueError: If the pipeline does not have a SaveResult component
    """
    # Find the SaveResult component name in the pipeline
    # pipeline.walk() Visits each component in the pipeline exactly once and yields its name and instance.
    # https://docs.haystack.deepset.ai/reference/pipeline-api#asyncpipelinewalk
    save_result_component_name = next(
        (name for name, comp in pipeline.walk() if isinstance(comp, SaveResult)),
        None,
    )

    if save_result_component_name is None:
        raise ValueError(
            "create_result_id_hook requires a pipeline with a SaveResult component. "
            "Do not use this hook for pipelines without SaveResult."
        )

    def hook(pipeline_run_args: dict) -> Generator:
        data: dict = {"result_id": result_id}
        if pop_documents_fn:
            data.update(pop_documents_fn())
        yield StreamingChunk(content=json.dumps(data) + "\n")

    return hook


logger = logging.getLogger(__name__)


class TracedPipelineRunner:
    """
    Helper class to run Haystack pipelines with OpenInference tracing.
    It wraps pipeline.run() calls under a parent OpenTelemetry spans and
    handles streaming and non-streaming responses.
    The parent span contains attributes and metadata for easy viewing in the Phoenix UI.

    It also provides boilerplate features like handling error logging and setting span status on exceptions.
    """

    def __init__(self, parent_span_name: str, pipeline: Pipeline) -> None:
        self.parent_span_name = parent_span_name
        self.pipeline = pipeline

    def _parent_span_name(self, suffix: str | None) -> str:
        return f"{self.parent_span_name}--{suffix}" if suffix else self.parent_span_name

    def stream_response(
        self,
        pipeline_run_args: dict,
        *,
        user_id: str,
        metadata: dict[str, Any],
        input_: Any | None = None,
        shorten_output: Callable[[str], str] = lambda resp: resp,
        parent_span_name_suffix: str | None = None,
        generator_hook: Callable[[dict], Generator] | None = None,
        cleanup_fn: Callable[[], Any] | None = None,
    ) -> Generator:
        """
        Run the pipeline with tracing and return a streaming response using hayhooks.streaming_generator().

        The shorten_output is used to shorten the span output attribute to make it readable in Phoenix.
        The parent_span_name_suffix is appended to the parent span name for easier region identification in Phoenix.
        The generator_hook can be used to yield additional chunks after the main pipeline.run() completes,
        such as yielding the result_id for reference by the frontend.
        The cleanup_fn is called in a finally block, guaranteeing execution even when the pipeline raises
        before the generator_hook runs (e.g., to release class-level component state like DocumentCapture entries).
        Its return value is ignored.
        """
        # Must set using attributes and metadata tracer context before calling tracer.start_as_current_span()
        with using_attributes(user_id=user_id, metadata=metadata):
            with phoenix_utils.tracer().start_as_current_span(  # pylint: disable=not-context-manager,unexpected-keyword-arg
                self._parent_span_name(parent_span_name_suffix),
                openinference_span_kind="chain",
            ) as span:
                assert isinstance(span, Span), f"Got unexpected {type(span)}"
                try:
                    span.set_attribute("streaming", True)
                    span.set_input(input_)

                    # hayhooks.streaming_generator() creates a thread that now inherits OpenTelemetry context
                    # thanks to ThreadingInstrumentor enabled in phoenix_utils.py
                    # streaming_generator() must be run inside the span context to inherit correctly
                    generator = hayhooks.streaming_generator(
                        pipeline=self.pipeline,
                        pipeline_run_args=pipeline_run_args,
                    )

                    # Stream chunks with each 'yield' call
                    chunk_count = 0
                    full_response = []
                    for chunk in generator:
                        chunk_count += 1
                        if hasattr(chunk, "content"):
                            full_response.append(chunk.content)
                        # Must yield chunks one by one for SSE
                        # Must yield in the tracer span context to have spans linked as child spans
                        yield chunk

                    # Call generator_hook if provided (inside span, after streaming)
                    # Do this after streaming all chunks so that the parent-child span relationship is established
                    if generator_hook:
                        for chunk in generator_hook(pipeline_run_args):
                            yield chunk

                    logger.info("Successfully streamed %d chunks", chunk_count)
                    response_text = "".join(full_response) if full_response else ""
                    span.set_output(shorten_output(response_text))
                    span.set_status(Status(StatusCode.OK))
                except PipelineRuntimeError as e:
                    logger.error("PipelineRuntimeError: %s", e, exc_info=True)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise HTTPException(status_code=500, detail=str(e)) from e
                except Exception as e:
                    logger.error("Error during streaming: %s", e, exc_info=True)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise HTTPException(status_code=500, detail=str(e)) from e
                finally:
                    if cleanup_fn:
                        cleanup_fn()

    def return_response(
        self,
        pipeline_run_args: dict,
        *,
        user_id: str,
        metadata: dict[str, Any],
        input_: Any | None = None,
        include_outputs_from: set[str] | None = None,
        extract_output: Callable[[dict], Any] = lambda resp: resp,
        parent_span_name_suffix: str | None = None,
    ) -> dict:
        """
        Run the pipeline with tracing and return the full response as a dict.
        The include_outputs_from is used to specify which component outputs to include in the final response dict.
        The extract_output is used to extract a specific part of the response for setting as the span output for readability in Phoenix.
        The parent_span_name_suffix is appended to the parent span name for easier region identification in Phoenix.
        """
        # Must set using_metadata context before calling tracer.start_as_current_span()
        with using_attributes(user_id=user_id, metadata=metadata):
            with phoenix_utils.tracer().start_as_current_span(  # pylint: disable=not-context-manager,unexpected-keyword-arg
                self._parent_span_name(parent_span_name_suffix),
                openinference_span_kind="chain",
            ) as span:
                try:
                    result = self.pipeline.run(
                        pipeline_run_args,
                        include_outputs_from=include_outputs_from,
                    )
                    # Shorter than span.set_attribute(SpanAttributes.INPUT_VALUE, ...)
                    span.set_attribute("streaming", False)
                    span.set_input(input_)
                    span.set_output(extract_output(result))
                    span.set_status(Status(StatusCode.OK))
                    return result
                except PipelineRuntimeError as e:
                    logger.error("PipelineRuntimeError: %s", e, exc_info=True)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise HTTPException(status_code=500, detail=str(e)) from e
                except Exception as e:
                    logger.error("Error during pipeline run: %s", e, exc_info=True)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}") from e
