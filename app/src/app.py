"""
This application uses Hayhooks to create an API service.
API requests are handled by Hayhooks and triggers specific Haystack pipelines (defined in pipeline_wrapper.py files).
Phoenix is used for prompt templates and OpenTelemetry-based tracing of API requests.
"""

import logging
from typing import Dict

from hayhooks import create_app
from hayhooks.settings import settings as hayhooks_settings

from src.app_config import config
from src.auth import ApiAuthMiddleware, pipeline_names
from src.common import phoenix_utils

logging.basicConfig(format="%(levelname)s - %(name)s -  %(message)s", level=logging.INFO)

# Fail closed: without a token every endpoint would be open, including Hayhooks'
# routes that deploy code
if not config.api_auth_token:
    raise RuntimeError("API_AUTH_TOKEN must be set")

logging.info("Configuring Phoenix...")
phoenix_utils.configure_phoenix()
logging.info("Phoenix configured.")

# Boot the standard Hayhooks app

logging.info("Starting Hayhooks app...")
hayhooks_app = create_app()
hayhooks_app.add_middleware(
    ApiAuthMiddleware,
    token=config.api_auth_token,
    pipelines=pipeline_names(hayhooks_settings.pipelines_dir),
    allow_docs=config.environment == "local",
)
logging.info("Hayhooks app started.")


@hayhooks_app.get("/health")
async def health_check() -> Dict[str, str]:
    logging.info("Health check returning OK.")
    return {"status": "ok", "detail": f"Environment {config.environment} is healthy."}
