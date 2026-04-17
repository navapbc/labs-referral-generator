"""
Components cannot be defined in pipelines themselves, so define them here.

The following applies to Pipeline, as well as AsyncPipeline.

When a Hayhooks API endpoint is called by a client, different threads are used
to handle the requests, but the same PipelineWrapper instance is used by the threads!
This means that pipeline component instances are used by different threads,
so the components must be thread-safe.
"""

import json
import logging
import threading
from json import JSONDecodeError
from pprint import pformat
from typing import Any, Callable, ClassVar, List, Optional, TypeVar
from uuid import UUID

from fastapi import UploadFile
from haystack import Document, component
from haystack.core.component.types import Variadic
from haystack.dataclasses.byte_stream import ByteStream
from haystack.dataclasses.chat_message import ChatMessage
from haystack.dataclasses.streaming_chunk import StreamingChunk
from openai import OpenAI
from openai.types.responses import (
    ResponseCreatedEvent,
    ResponseFunctionWebSearch,
    ResponseOutputItemDoneEvent,
)
from openai.types.responses.response_function_web_search import ActionSearch
from opentelemetry import trace
from pydantic import BaseModel, ValidationError

from src.app_config import config
from src.common import phoenix_utils
from src.common.send_email import send_email
from src.db.models.api_data_models import LlmResponse

logger = logging.getLogger(__name__)


@component
class EchoNode:
    """
    A custom node/component that simply echoes the input messages.
    Useful for testing, debugging, or as a placeholder in pipelines.
    """

    @component.output_types(full_prompt=List[ChatMessage])
    def run(self, prompt: List[ChatMessage], history: List[ChatMessage]) -> dict:
        full_prompt = history + prompt
        logger.info("Full prompt: %s", pformat(full_prompt))
        return {"full_prompt": full_prompt}


@component
class UploadFilesToByteStreams:
    """Converts list of UploadFile to list of ByteStream"""

    @component.output_types(byte_streams=List[ByteStream])
    def run(self, files: List[UploadFile]) -> dict:
        return {
            "byte_streams": [
                ByteStream.from_dict(
                    {
                        "data": f.file.read(),
                        "meta": {"filename": f.filename, "size": f.size},
                        "mime_type": f.content_type,
                    }
                )
                for f in files
            ]
        }


@component
class SaveResult:
    """Saves LLM response to the database."""

    @component.output_types(result_id=str)
    def run(self, replies: List[ChatMessage], result_id: str | None = None) -> dict:
        logger.info("Saving LLM result to database: %r", pformat(replies, width=160))
        assert replies, "Expected at least one reply"
        text_result = replies[0].text
        with config.db_session() as db_session, db_session.begin():
            # Use provided result_id or let SQLAlchemy generate one
            if result_id:
                llm_result = LlmResponse(id=UUID(result_id), raw_text=text_result)
            else:
                llm_result = LlmResponse(raw_text=text_result)
            db_session.add(llm_result)
            db_session.flush()  # To get the id assigned
            result_id_str = str(llm_result.id)
            logger.info("Saved LLM result with id=%s", result_id_str)
            return {"result_id": result_id_str}


@component
class DummyChatGenerator:
    """
    A dummy chat generator that echoes back the messages used only for development.
    Temporarily replace AmazonBedrockChatGenerator with this to avoid incurring LLM costs.
    """

    @component.output_types(replies=List[ChatMessage])
    def run(self, messages: List[ChatMessage]) -> dict:
        replies = messages
        logger.info("replies: %s", pformat(replies))
        reply = [f"## {msg.role} said: {msg.text[:200] if msg.text else " "}..." for msg in replies]
        return {"replies": [ChatMessage.from_assistant("\n\n".join(reply))]}


@component
class LoadResultOptional:
    """
    Loads result from database with optional result_id.

    If result_id is None or empty string, returns an empty dict instead of raising an error.
    This allows pipelines to gracefully handle optional inputs.

    Returns:
        dict: {"result_json": dict} where dict is either the loaded JSON or empty dict
    """

    @staticmethod
    def _load_and_parse_result(result_id: str) -> dict:
        """
        Helper function to load result from database and parse JSON.

        Args:
            result_id: The UUID of the result to load

        Returns:
            dict: The parsed JSON result

        Raises:
            ValueError: If result not found or JSON parsing fails
        """
        with config.db_session() as db_session, db_session.begin():
            db_record = (
                db_session.query(LlmResponse).filter(LlmResponse.id == result_id).one_or_none()
            )

            if not db_record:
                raise ValueError(f"No result found with id={result_id}")

            logger.info("Loaded LlmResponse:\n%s", db_record.raw_text)
            text = db_record.raw_text

        # Extract JSON object from raw_text string by searching for the first '{' and last '}'
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError(f"Invalid JSON format in result with id={result_id}: {text!r}")

        json_dict = json.loads(text[start : end + 1])
        return json_dict

    @component.output_types(result_json=dict)
    def run(self, result_id: Optional[str]) -> dict:
        # Return empty dict if no result_id provided
        if not result_id:
            logger.debug("No result_id provided, returning empty dict")
            return {"result_json": {}}

        # Otherwise, use shared helper to load and parse result
        json_dict = self._load_and_parse_result(result_id)
        return {"result_json": json_dict}


@component
class RemoveResourcesForEmail:
    """
    Filters out excluded resources from a resources dict before emailing.

    This component is used in the email_responses pipeline to remove resources
    that the user has chosen to exclude from the email.

    Args:
        result_json: Dict containing resources data (from LoadResultOptional)
        excluded_resource_names: Optional list of resource names to exclude

    Returns:
        dict: {"resources_dict": dict} with excluded resources removed

    Behavior:
        - If no exclusions provided, passes through result_json unchanged
        - If exclusions provided, filters out resources with matching names
        - Handles errors gracefully - logs warning and continues with original data
        - Logs exclusions for observability
    """

    @component.output_types(resources_dict=dict)
    def run(self, result_json: dict, excluded_resource_names: Optional[List[str]] = None) -> dict:
        # If result_json is empty or no exclusions, pass through unchanged
        if not result_json or not excluded_resource_names:
            logger.debug(
                "RemoveResourcesForEmail: No exclusions or empty result, passing through unchanged"
            )
            return {"resources_dict": result_json}

        # If exclusions list is empty, pass through unchanged
        if not excluded_resource_names:
            logger.debug(
                "RemoveResourcesForEmail: Empty exclusions list, passing through unchanged"
            )
            return {"resources_dict": result_json}

        try:
            # Get the resources list from the result
            resources = result_json.get("resources", [])
            if not resources:
                logger.debug("RemoveResourcesForEmail: No resources in result_json")
                return {"resources_dict": result_json}

            # Log the exclusion request
            logger.info(
                "RemoveResourcesForEmail: Filtering out %d resource(s): %s",
                len(excluded_resource_names),
                excluded_resource_names,
            )

            # Convert excluded names to set for O(1) lookup
            excluded_names_set = set(excluded_resource_names)

            # Single pass: filter resources and collect all resource names
            filtered_resources = []
            existing_resource_names = set()
            original_count = len(resources)

            for resource in resources:
                resource_name = resource.get("name")
                existing_resource_names.add(resource_name)

                # Keep resource if it's not in the exclusion list
                if resource_name not in excluded_names_set:
                    filtered_resources.append(resource)

            removed_count = original_count - len(filtered_resources)

            # Check for excluded names that don't exist in the original list
            for excluded_name in excluded_names_set:
                if excluded_name not in existing_resource_names:
                    logger.error(
                        "RemoveResourcesForEmail: Excluded resource name '%s' not found in original resources list. Skipping"
                        "Available names: %s",
                        excluded_name,
                        list(existing_resource_names),
                    )

            # Log the result
            logger.info(
                "RemoveResourcesForEmail: Removed %d resource(s), %d remaining",
                removed_count,
                len(filtered_resources),
            )

            # Create a new dict with filtered resources
            # Unpack result_json to preserve other fields, then override the 'resources' key with filtered list
            filtered_result = {**result_json, "resources": filtered_resources}
            return {"resources_dict": filtered_result}

        except Exception as e:
            # Log the error and pass through original data
            logger.warning(
                "RemoveResourcesForEmail: Error filtering resources, passing through unchanged. Error: %s",
                e,
                exc_info=True,
            )
            return {"resources_dict": result_json}


@component
class OpenAIWebSearchGenerator:
    """Searches the web using OpenAI's web search capabilities and generates a response."""

    def __init__(self) -> None:
        """
        Initialize the OpenAI web search generator.
        """

        self.client = OpenAI()
        # Declare this attribute so it can be set when streaming_generator() is called
        self.streaming_callback: Callable | None = None

    @component.output_types(replies=List[ChatMessage])
    def run(
        self,
        messages: list[ChatMessage],
        domain: str | None = None,
        model: str = config.default_openai_model_version,
        reasoning_effort: str = config.default_openai_reasoning_level,
        streaming: bool = False,
        temperature: float = 1.0,
    ) -> dict:
        """
        Run the OpenAI web search generator.

        Args:
            messages: List of ChatMessage objects to send to the API
            domain: Domain to restrict web search to
            model: LLM model to use
            reasoning_effort: Reasoning effort level
            streaming: Whether to use streaming response
            temperature: temperature for the LLM

        Returns:
            Dictionary with response key containing string of response
        """

        logger.info(
            "Calling OpenAI API with web_search, model=%s, domain=%s, reasoning_effort=%s, streaming=%s",
            model,
            domain,
            reasoning_effort,
            streaming,
        )

        assert len(messages) == 1
        prompt = messages[0].text
        logger.debug("Prompt: %s", pformat(prompt, width=160))

        api_params: dict = {
            "model": model,
            "input": prompt,
            "reasoning": {"effort": reasoning_effort},
            "tools": [{"type": "web_search"}],
            "temperature": temperature,
            # Request full source URLs consulted during web search
            "include": ["web_search_call.action.sources"],
        }

        if domain:
            api_params["tools"][0]["filters"] = {"allowed_domains": [domain]}

        if streaming:
            logger.info(
                "Starting OpenAI streaming request (model=%s, reasoning_effort=%s)",
                model,
                reasoning_effort,
            )
            api_params["stream"] = True

            try:
                response = self.client.responses.create(**api_params)
                full_text = self._stream_response(response)
                return {"replies": [ChatMessage.from_assistant(full_text)]}
            except Exception as e:
                logger.error("Failed to stream response: %s", e, exc_info=True)
                raise
        else:
            # Non-streaming response
            response = self.client.responses.create(**api_params)

            # Log model params to Phoenix span
            span = trace.get_current_span()
            span.set_attribute("model", str(response.model))
            span.set_attribute("reasoning_effort", reasoning_effort)
            span.set_attribute("temperature", str(response.temperature))

            web_search_responses = [
                item for item in response.output if isinstance(item, ResponseFunctionWebSearch)
            ]
            self._add_child_spans(web_search_responses)

            return {
                "replies": [ChatMessage.from_assistant(response.output_text)],
                "temperature": response.temperature,
                # Also add web_search responses to parent span attributes
                "web_search": [str(result) for result in web_search_responses],
            }

    def _stream_response(self, response: Any) -> str:
        # Collect full response while streaming
        full_text = ""
        chunk_count = 0

        for openai_chunk in response:
            chunk_count += 1
            chunk_text = ""

            # Extract text from OpenAI Responses API events
            if hasattr(openai_chunk, "type"):
                # Check delta attribute (for text delta events)
                if not chunk_text and hasattr(openai_chunk, "delta"):
                    delta = openai_chunk.delta
                    if isinstance(delta, str):
                        chunk_text = delta
                    elif isinstance(delta, list):
                        chunk_text = "".join(str(item) for item in delta)
                    elif hasattr(delta, "content"):
                        chunk_text = delta.content or ""
                    elif hasattr(delta, "text"):
                        chunk_text = delta.text or ""

            # Fallback for non-Responses API format
            if not chunk_text and hasattr(openai_chunk, "output_text"):
                chunk_text = openai_chunk.output_text or ""

            if chunk_text:
                full_text += chunk_text
                # Convert to Haystack StreamingChunk and call the callback
                streaming_chunk = StreamingChunk(content=chunk_text)
                assert (
                    self.streaming_callback is not None
                ), "Expected streaming_callback to be set by Hayhooks"
                self.streaming_callback(streaming_chunk)

            # Capture metadata from OpenAI chunk; handle each type of Response*Event
            if isinstance(openai_chunk, ResponseOutputItemDoneEvent):
                if isinstance(openai_chunk.item, ResponseFunctionWebSearch):
                    self._add_child_spans([openai_chunk.item])
            elif isinstance(openai_chunk, ResponseCreatedEvent):
                resp = openai_chunk.response
                span = trace.get_current_span()
                span.set_attribute("model", str(resp.model))
                span.set_attribute("reasoning_effort", str(resp.reasoning))
                span.set_attribute("temperature", str(resp.temperature))

        logger.info("Streaming complete: %d chunks, %d characters", chunk_count, len(full_text))
        if not full_text:
            logger.warning("No text collected during streaming")
        return full_text

    def _add_child_spans(
        self,
        web_search_responses: list[ResponseFunctionWebSearch],
    ) -> None:
        for tool_call in web_search_responses:
            action = tool_call.action

            # Skip internal OpenAI warmup searches (e.g. "calculator: 0")
            if isinstance(action, ActionSearch) and action.query.startswith("calculator:"):
                continue

            # Build a single dict used for both span attributes and tool parameters.
            # For ActionSearch, extract the query, expanded sub-queries, and source URLs.
            # The 'queries' field is undocumented (extra field via Pydantic extra='allow')
            # containing the expanded sub-queries the model actually searched for.
            params: dict[str, Any] = {"action_type": action.type}
            if isinstance(action, ActionSearch):
                params["query"] = action.query
                queries = getattr(action, "queries", None)
                if queries:
                    params["queries"] = queries
                if action.sources:
                    urls = [s.url for s in action.sources if s and s.url]
                    if urls:
                        params["source_urls"] = urls

            with phoenix_utils.tracer().start_as_current_span(  # pylint: disable=not-context-manager,unexpected-keyword-arg
                tool_call.type,
                openinference_span_kind="tool",
                attributes={
                    k: json.dumps(v) if isinstance(v, list) else str(v) for k, v in params.items()
                },
            ) as span:
                span.set_tool(name="openai_web_search", parameters=params)


EMAIL_INTRO = """\
Hello,

Here is your personalized report with resources your case manager recommends to support your goals.
You've already taken a great first step by exploring these options.

**Your next step**: Look over the resources to see contact info and details about how to get started.\
"""


@component
class EmailResponses:
    """
    Unified email component that handles sending resources, action plans, or both.

    This component consolidates the functionality of EmailResult, EmailActionPlan, and
    EmailFullResult into a single component that dynamically formats and sends emails
    based on what content is provided.

    Scenarios handled:
        1. Resources only: resources_dict provided, action_plan_dict empty
        2. Action plan only: action_plan_dict provided, resources_dict empty
        3. Both: both dicts provided

    Args:
        email: Recipient email address
        resources_dict: Dict containing resources data (empty dict if not provided)
        action_plan_dict: Dict containing action plan data (empty dict if not provided)

    Returns:
        dict: Contains status ("success" or "failed"), email, and message content

    Raises:
        ValueError: If neither resources_dict nor action_plan_dict has content
    """

    @component.output_types(status=str, email=str, message=str)
    def run(self, email: str, resources_dict: dict, action_plan_dict: dict) -> dict:
        # Determine what content we have
        # Check if resources dict has a non-empty "resources" list
        has_resources = bool(resources_dict and resources_dict.get("resources"))
        # Check if action plan dict has content (title, summary, or content fields)
        has_action_plan = bool(
            action_plan_dict
            and (
                action_plan_dict.get("title")
                or action_plan_dict.get("summary")
                or action_plan_dict.get("content")
            )
        )

        # Validate that at least one type of content is provided
        if not has_resources and not has_action_plan:
            logger.error(
                "EmailResponses: No content to email resources_dict=%r, action_plan_dict=%r",
                resources_dict,
                action_plan_dict,
            )
            raise ValueError(
                "At least one of resources_dict or action_plan_dict must contain valid data. "
                f"Received resources_dict={bool(resources_dict)}, action_plan_dict={bool(action_plan_dict)}"
            )

        logger.info(
            "Emailing to %s (resources=%s, action_plan=%s)", email, has_resources, has_action_plan
        )

        # Log the content we're working with
        if has_resources:
            logger.debug("Resources JSON content:\n%s", json.dumps(resources_dict, indent=2))
        if has_action_plan:
            logger.debug("Action plan JSON content:\n%s", json.dumps(action_plan_dict, indent=2))

        # Format content based on what's available
        message_parts = [EMAIL_INTRO]

        if has_resources:
            formatted_resources = "\n\n".join(
                [
                    self._format_resource(resource)
                    for resource in resources_dict.get("resources", [])
                ]
            )
            message_parts.append(formatted_resources)

        if has_action_plan:
            formatted_action_plan = self._format_action_plan(action_plan_dict)
            message_parts.append(formatted_action_plan)

        message = "\n\n".join(message_parts)

        # Set subject based on what's included
        if has_resources and has_action_plan:
            subject = "Your Requested Resources and Action Plan"
        elif has_resources:
            subject = "Your Requested Resources"
        else:  # has_action_plan only
            subject = "Your Personalized Action Plan"

        # Send email via AWS SES
        success = send_email(recipient=email, subject=subject, body=message)
        status = "success" if success else "failed"

        logger.info("Email send status: %s", status)
        return {"status": status, "email": email, "message": message}

    def _format_resource(self, resource: dict) -> str:
        return "\n".join(
            [
                f"### {resource.get('name', 'Unnamed Resource')}",
                f"- Referral Type: {resource.get('referral_type', 'None')}",
                f"- Description: {resource.get('description', 'None')}",
                f"- Website: {resource.get('website', 'None')}",
                f"- Phone: {', '.join(resource.get('phones', ['None']))}",
                f"- Email: {', '.join(resource.get('emails', ['None']))}",
                f"- Addresses: {', '.join(resource.get('addresses', ['None']))}",
            ]
        )

    def _format_action_plan(self, action_plan: dict) -> str:
        """Format the action plan for email display. Returns empty string if no action plan."""
        if not action_plan:
            return ""

        title = action_plan.get("title", "Your Action Plan")
        summary = action_plan.get("summary", "")
        content = action_plan.get("content", "")

        parts = [f"## {title}"]
        if summary:
            parts.append(f"\n{summary}")
        if content:
            parts.append(f"\n{content}")

        return "\n".join(parts)


BaseModelT = TypeVar("BaseModelT", bound=BaseModel)


# Consider replacing this with https://docs.haystack.deepset.ai/docs/jsonschemavalidator
@component
class LlmOutputValidator:
    def __init__(self, pydantic_model: type[BaseModelT]):
        # Note that components must be thread-safe, so do not maintain state across runs
        self.pydantic_model = pydantic_model

    @component.output_types(
        valid_replies=List[ChatMessage],
        invalid_replies=Optional[List[ChatMessage]],
        error_message=Optional[str],
    )
    def run(self, replies: List[ChatMessage]) -> dict:
        assert len(replies) == 1, "Expected exactly one reply"
        reply = replies[0]

        try:
            assert reply.text is not None, "Reply text is None"
            output_dict = json.loads(reply.text)
            self.pydantic_model.model_validate(output_dict)
            return {"valid_replies": replies}
        except (ValueError, ValidationError) as e:
            logger.error(
                (
                    "LlmOutputValidator: Invalid JSON from LLM - will try again...\n"
                    "Parsing error: %s\n"
                    "Output from LLM:\n %s \n"
                ),
                e,
                reply,
            )
            return {"invalid_replies": replies, "error_message": str(e)}


@component
class ReadableLogger:
    """Logs input in a human-readable format for debugging purposes."""

    @staticmethod
    def default_mapper(msg: Any) -> Optional[Any]:
        if isinstance(msg, ChatMessage):
            # Don't log 'system' messages
            return msg if msg.role in ["user", "assistant"] else None
        return msg

    def __init__(self, mapper: Optional[Callable] = None) -> None:
        self.mapper = mapper if mapper is not None else self.default_mapper

    @component.output_types(logs=list)
    def run(self, messages_list: Variadic[List]) -> dict:
        logs = []
        for messages in messages_list:
            for item in messages:
                mapped_item = self.mapper(item)
                if mapped_item is None:
                    continue

                if isinstance(mapped_item, ChatMessage):
                    for content in mapped_item._content:
                        logs.append(self.parse_json_if_possible(content))
                else:
                    logs.append(self.parse_json_if_possible(mapped_item))
        return {"logs": logs}

    def parse_json_if_possible(self, content: Any) -> Any:
        if hasattr(content, "text"):
            # Usually for ChatMessage._content[*] but could be for any object with 'text' attribute
            try:
                return json.loads(content.text)
            except JSONDecodeError:
                logger.warning("Failed to parse content as JSON: %s", content.text)
                return content.text

        return content


@component
class DocumentCapture:
    """Passes Haystack Documents through unchanged while capturing their content as strings.

    Acts as a side-effect component: documents flow to the next component as normal,
    but their text content is stored in a class-level dict keyed by result_id so that
    the content can be retrieved later (e.g. in a streaming generator hook).

    Thread-safe: multiple concurrent pipeline runs are isolated by result_id.
    """

    _storage: ClassVar[dict[str, list[str]]] = {}
    _lock: ClassVar[threading.Lock] = threading.Lock()

    @component.output_types(documents=list[Document])
    def run(self, documents: list[Document], result_id: str = "") -> dict:
        if result_id:
            contents = [d.content for d in documents if d.content]
            with self.__class__._lock:
                self.__class__._storage[result_id] = contents
        return {"documents": documents}

    @classmethod
    def pop(cls, result_id: str) -> list[str]:
        """Retrieve and remove stored document content for the given result_id."""
        with cls._lock:
            return cls._storage.pop(result_id, [])


@component
class DocumentMetadataAdder:
    def __init__(self, metadata: dict[str, Any]) -> None:
        self.metadata = metadata

    @component.output_types(documents=list[Document])
    def run(self, documents: list[Document]) -> dict:
        for doc in documents:
            doc.meta.update(self.metadata)
        return {"documents": documents}
