"""
Authentication and route allow-listing for the Hayhooks API.

The API is called by the frontend's server-side proxy and by scripts such as
`make run-experiment`, never directly by browsers. Every request except the
health check must carry `Authorization: Bearer <API_AUTH_TOKEN>`.

Only the routes the app uses are reachable. Hayhooks also registers management
routes (deploy_files, deploy-yaml, undeploy, files, traces, ...) that deploy
code or expose data, and has no setting to turn them off, so this middleware
answers 404 for anything that isn't allow-listed.
"""

import hmac
import logging
from pathlib import Path
from typing import Iterable

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

PUBLIC_PATHS = frozenset({"/health"})
# Interactive API docs; only reachable when running locally
DOCS_PATHS = frozenset({"/docs", "/openapi.json"})
# OpenAI-compatible streaming endpoint; the `model` field names the pipeline
CHAT_COMPLETIONS_PATH = "/chat/completions"


def pipeline_names(pipelines_dir: str | Path) -> set[str]:
    """Names of the pipelines Hayhooks deploys at startup from pipelines_dir."""
    return {p.name for p in Path(pipelines_dir).iterdir() if (p / "pipeline_wrapper.py").is_file()}


class ApiAuthMiddleware:
    """ASGI middleware that requires a bearer token and allow-lists routes.

    Pure ASGI (not BaseHTTPMiddleware) so streaming responses pass through unbuffered.
    """

    def __init__(
        self,
        app: ASGIApp,
        token: str,
        pipelines: Iterable[str],
        allow_docs: bool = False,
    ) -> None:
        if not token:
            raise ValueError("API auth token must be non-empty")
        self.app = app
        self.token = token.encode()
        self.allowed_post_paths = frozenset(
            {f"/{name}/run" for name in pipelines} | {CHAT_COMPLETIONS_PATH}
        )
        self.allow_docs = allow_docs

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            await self.app(scope, receive, send)
            return
        if scope["type"] != "http":
            # No websocket routes are used; refuse rather than skip the checks below
            await send({"type": "websocket.close", "code": 1008})
            return

        path = scope["path"]
        method = scope["method"]

        if method in ("GET", "HEAD") and (
            path in PUBLIC_PATHS or (self.allow_docs and path in DOCS_PATHS)
        ):
            await self.app(scope, receive, send)
            return

        if not (method == "POST" and path in self.allowed_post_paths):
            await JSONResponse({"detail": "Not Found"}, status_code=404)(scope, receive, send)
            return

        if not self._has_valid_token(scope):
            logger.warning("Rejected unauthenticated request to %s", path)
            await JSONResponse(
                {"detail": "Not authenticated"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )(scope, receive, send)
            return

        await self.app(scope, receive, send)

    def _has_valid_token(self, scope: Scope) -> bool:
        for name, value in scope["headers"]:
            if name == b"authorization":
                scheme, _, credentials = value.partition(b" ")
                return scheme.lower() == b"bearer" and hmac.compare_digest(
                    credentials.strip(), self.token
                )
        return False
