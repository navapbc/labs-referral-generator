import json
import logging
import os
from pprint import pformat

import httpx
import phoenix.otel
from openinference.instrumentation import OITracer
from opentelemetry.instrumentation.threading import ThreadingInstrumentor
from opentelemetry.trace import NoOpTracerProvider, TracerProvider

# https://docs.arize.com/phoenix/tracing/integrations-tracing/haystack
# Arize's Phoenix observability platform
from phoenix.client import Client
from phoenix.client.types import PromptVersion

from src.app_config import config

logger = logging.getLogger(__name__)


class ContextDetachErrorFilter(logging.Filter):
    """Filter to suppress harmless OpenTelemetry context detach errors in threaded environments.

    When using OpenInference instrumentation with threading (e.g., hayhooks.streaming_generator),
    context tokens may be created in one thread and detached in another during cleanup,
    causing harmless "Failed to detach context" or "was created in a different Context" errors.

    These errors don't affect functionality - the spans are created correctly and traces work as expected.
    This filter suppresses these specific error messages to reduce log noise.

    Related issue: https://github.com/Arize-ai/openinference/issues/306
    This is the recommended pattern until OpenInference fixes the upstream issue.
    Similar approaches are used by other projects facing this issue:
    - Google ADK (https://github.com/google/adk-python/issues/1670)
    - Agno framework (https://github.com/agno-agi/agno/issues/5208)
    - Langfuse (https://github.com/langfuse/langfuse/issues/8316)
    """

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()

        # Suppress "Failed to detach context" errors
        if "Failed to detach context" in message:
            return False

        # Suppress "was created in a different Context" errors
        if "was created in a different Context" in message:
            return False

        # Also check exception info if present
        if record.exc_info and record.exc_info[0] is ValueError:
            exc_str = str(record.exc_info[1])
            if "was created in a different Context" in exc_str:
                return False

        return True


def _suppress_context_detach_errors() -> None:
    """Add filter to suppress harmless OpenTelemetry context detach errors."""
    otel_context_logger = logging.getLogger("opentelemetry.context")
    otel_context_logger.addFilter(ContextDetachErrorFilter())
    logger.info("Added filter to suppress harmless OpenTelemetry context detach errors")


def _create_client(
    url: str = config.phoenix_collector_endpoint, api_key: str | None = None
) -> Client:
    logger.info("Creating Phoenix client to %s", url)
    return Client(base_url=url, api_key=api_key)


def service_alive() -> bool:
    client = _create_client()
    try:
        projects = client.projects.list()
        logger.info("Phoenix service is alive: %s", projects)
        return True
    except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as error:
        logger.error("Error connecting to Phoenix service: %s", error)
    except Exception as error:
        logger.error("Unexpected error when checking Phoenix service: %s", error)
    return False


tracer_provider: TracerProvider = NoOpTracerProvider()


def configure_phoenix(only_if_alive: bool = True) -> None:
    "Set only_if_alive=True to fail fast if Phoenix is not reachable."
    if only_if_alive and not service_alive():
        logger.error(
            "Cannot configure Phoenix service at %s",
            config.phoenix_collector_endpoint,
        )
        return

    trace_endpoint = f"{config.phoenix_collector_endpoint}/v1/traces"
    logger.info("Using Phoenix OTEL endpoint: %s", trace_endpoint)

    # Using Phoenix docs: https://arize.com/docs/phoenix/tracing/integrations-tracing/haystack
    logger.info("Using phoenix.otel.register with batch_otel=%s", config.batch_otel)
    # This uses PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_PROJECT_NAME env variables
    # and PHOENIX_API_KEY to handle authentication to Phoenix.
    global tracer_provider
    tracer_provider = phoenix.otel.register(
        endpoint=trace_endpoint,
        batch=config.batch_otel,
        # Auto-instrument based on installed OpenInference dependencies
        auto_instrument=True,
    )

    # Enable threading instrumentation to propagate OpenTelemetry context across threads
    # This fixes the issue where hayhooks.streaming_generator() creates threads without
    # inheriting the parent span context, causing orphaned spans in Phoenix traces.
    # https://github.com/langfuse/langfuse/issues/8316#issuecomment-3154235201
    ThreadingInstrumentor().instrument()
    logger.info(
        "Threading instrumentation enabled for OpenTelemetry context propagation during streaming"
    )

    # Suppress harmless context detach errors that occur when OpenInference instrumentation
    # tries to clean up context tokens in different threads during streaming.
    _suppress_context_detach_errors()


_tracer: OITracer | None = None


def tracer() -> OITracer:
    global _tracer
    if _tracer is None:
        new_tracer = tracer_provider.get_tracer(__name__)
        assert isinstance(new_tracer, OITracer), f"Got unexpected {type(new_tracer)}"
        _tracer = new_tracer
    return _tracer


def get_prompt_template(prompt_name: str, prompt_version_id: str = "") -> PromptVersion:
    """Retrieve a prompt template from Phoenix by name.
    Falls back to loading from the cached JSON file in the prompts/ folder
    if Phoenix is unavailable.
    https://arize.com/docs/phoenix/sdk-api-reference/python/overview#prompt-management
    """
    try:
        prompt_params = which_prompt_version(prompt_name, prompt_version_id)
        logger.info("Using the prompt having %s", prompt_params)
        client = _create_client()
        prompt = client.prompts.get(**prompt_params)
        logger.info(
            "Retrieved prompt with %r: id='%s'",
            prompt_params,
            prompt.id,
        )
        return prompt
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        prompt_file = os.path.join(PROMPTS_FOLDER, f"{prompt_name}.json")
        logger.warning(
            "Phoenix unreachable for prompt %r (%s: %s). " "Falling back to cached prompt file: %s",
            prompt_name,
            type(e).__name__,
            e,
            prompt_file,
        )
        return load_prompt_version(prompt_file)
    except Exception as e:
        prompt_file = os.path.join(PROMPTS_FOLDER, f"{prompt_name}.json")
        logger.error(
            "Unexpected error retrieving prompt %r from Phoenix (%s: %s). "
            "Falling back to cached prompt file: %s",
            prompt_name,
            type(e).__name__,
            e,
            prompt_file,
        )
        return load_prompt_version(prompt_file)


def which_prompt_version(prompt_name: str, prompt_version_id: str = "") -> dict:
    if prompt_version_id:
        return {"prompt_version_id": prompt_version_id}

    if config.environment == "local":
        # Get the latest version regardless of tags
        return {"prompt_identifier": prompt_name}

    # Use the hardcoded version ids
    return {"prompt_version_id": config.PROMPT_VERSIONS[prompt_name]}


def client_to_deployed_phoenix() -> Client:
    url = os.environ.get("DEPLOYED_PHOENIX_URL")
    api_key = os.environ.get("DEPLOYED_PHOENIX_API_KEY")
    logger.info("Creating client to deployed Phoenix at %s with API key: %r", url, api_key)
    assert url, "DEPLOYED_PHOENIX_URL is not set -- add it to override.env"
    assert api_key, "DEPLOYED_PHOENIX_API_KEY is not set -- add it to override.env"
    return _create_client(url, api_key=api_key)


def copy_deployed_prompts() -> None:
    logging.basicConfig(format="%(levelname)s - %(name)s -  %(message)s", level=logging.INFO)

    url = os.environ.get("DEPLOYED_PHOENIX_URL")
    api_key = os.environ.get("DEPLOYED_PHOENIX_API_KEY")

    if not url or not api_key:
        logger.warning(
            "DEPLOYED_PHOENIX_URL or DEPLOYED_PHOENIX_API_KEY not set. "
            "Falling back to loading prompts from JSON files in %s/",
            PROMPTS_FOLDER,
        )
        load_prompts_from_json()
        return

    try:
        src_client = client_to_deployed_phoenix()
        local_client = _create_client()
        for prompt in list_prompts(src_client):
            # The prompt id is base64 encoding of 'Prompt:N' where N is simply a counter
            logger.info("Copying prompt: %r with id=%r", prompt["name"], prompt["id"])
            copy_prompt(src_client, local_client, prompt["name"])
    except (
        httpx.ConnectError,
        httpx.TimeoutException,
        httpx.HTTPStatusError,
        httpx.InvalidURL,
    ) as e:
        logger.warning(
            "Could not reach deployed Phoenix at %s (%s). "
            "Falling back to loading prompts from JSON files in %s/",
            url,
            e,
            PROMPTS_FOLDER,
        )
        load_prompts_from_json()


def list_prompts(client: Client) -> list[dict]:
    "client.prompts doesn't have a list() method, so use the underlying httpx client."
    response = client._client.get("/v1/prompts")
    return response.json()["data"]


def copy_prompt(src_client: Client, local_client: Client, prompt_name: str) -> None:
    "Copy a prompt from src_client to local_client"
    if prompt_name not in config.PROMPT_VERSIONS:
        logger.warning("No version id found for prompt %r -- skipping", prompt_name)
        return

    prompt_ver = src_client.prompts.get(prompt_version_id=config.PROMPT_VERSIONS[prompt_name])
    logger.info(
        "Retrieved prompt with id='%s'\n%s", prompt_ver.id, pformat(prompt_ver._dumps(), width=160)
    )

    prompt_file = save_prompt_version(prompt_name, prompt_ver)
    loaded_prompt_ver = load_prompt_version(prompt_file)
    assert prompt_ver._dumps() == loaded_prompt_ver._dumps(), "Loaded prompt does not match saved"

    logger.info("Creating prompt %r in %r", prompt_name, local_client._client.base_url)
    # If prompt_name already exists, a new prompt version will be created
    local_client.prompts.create(
        version=loaded_prompt_ver,
        name=prompt_name,
        prompt_description=loaded_prompt_ver._description,
    )


PROMPTS_FOLDER = "prompts"


def save_prompt_version(prompt_name: str, prompt_ver: PromptVersion) -> str:
    # Save prompt to file
    os.makedirs(PROMPTS_FOLDER, exist_ok=True)
    prompt_file = os.path.join(PROMPTS_FOLDER, f"{prompt_name}.json")
    with open(prompt_file, "w", encoding="utf-8") as f:
        json.dump(prompt_ver._dumps(), f, indent=4)

    # Also save prompt text separately for easier viewing of differences
    prompt_text_file = os.path.join(PROMPTS_FOLDER, f"{prompt_name}.md")
    with open(prompt_text_file, "w", encoding="utf-8") as f:
        for msg in prompt_ver._template["messages"]:
            for content in msg["content"]:
                if isinstance(content, dict) and "text" in content:
                    f.write("==========================\n\n" + content["text"] + "\n\n")  # type: ignore

    logger.info("Saved prompt %r to %r", prompt_name, prompt_file)
    return prompt_file


def load_prompt_version(prompt_file: str) -> PromptVersion:
    # Load prompt from file
    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt_json = json.load(f)
    prompt_ver = PromptVersion._loads(prompt_json)
    logger.info("Loaded prompt from %r", prompt_file)
    return prompt_ver


def load_prompts_from_json() -> None:
    local_client = _create_client()
    for prompt_name in config.PROMPT_VERSIONS.keys():
        prompt_file = os.path.join(PROMPTS_FOLDER, f"{prompt_name}.json")
        prompt_ver = load_prompt_version(prompt_file)

        logger.info("Creating prompt %r in %r", prompt_name, local_client._client.base_url)
        # If prompt_name already exists, a new prompt version will be created
        local_client.prompts.create(
            version=prompt_ver,
            name=prompt_name,
            prompt_description=prompt_ver._description,
        )


def list_prompt_version_ids(prompt_name: str, client: Client) -> list[str]:
    "List all version ids for a given prompt name. client.prompts doesn't have a list_versions() method."
    response = client._client.get(f"/v1/prompts/{prompt_name}/versions")
    resp_data = response.json()["data"]
    # version tags are not in the response
    return [ver["id"] for ver in resp_data]
    # To get tags for the version: client.prompts.tags.list(prompt_version_id=version_id)
