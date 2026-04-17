"""
This application uses Hayhooks to create an API service.
API requests are handled by Hayhooks and triggers specific Haystack pipelines (defined in pipeline_wrapper.py files).
Phoenix is used for prompt templates and OpenTelemetry-based tracing of API requests.
"""

import logging
from typing import Dict

from hayhooks import create_app

from src.app_config import config
from src.common import phoenix_utils

logging.basicConfig(format="%(levelname)s - %(name)s -  %(message)s", level=logging.INFO)

logging.info("Configuring Phoenix...")
phoenix_utils.configure_phoenix()
logging.info("Phoenix configured.")

# Boot the standard Hayhooks app

logging.info("Starting Hayhooks app...")
hayhooks_app = create_app()
logging.info("Hayhooks app started.")


@hayhooks_app.get("/health")
async def health_check() -> Dict[str, str]:
    logging.info("Health check returning OK.")
    return {"status": "ok", "detail": f"Environment {config.environment} is healthy."}
