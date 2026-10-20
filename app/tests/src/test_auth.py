import re
from typing import Iterator

import pytest
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient
from hayhooks import create_app
from hayhooks.settings import settings as hayhooks_settings

from src.auth import ApiAuthMiddleware, pipeline_names

TOKEN = "test-token-123"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def build_app(allow_docs: bool = False) -> FastAPI:
    """Minimal app with the shapes of route Hayhooks registers."""
    app = FastAPI()

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.post("/my_pipeline/run")
    def run() -> dict:
        return {"result": "ran"}

    @app.post("/chat/completions")
    def chat() -> StreamingResponse:
        def chunks() -> Iterator[str]:
            yield "data: one\n\n"
            yield "data: two\n\n"

        return StreamingResponse(chunks(), media_type="text/event-stream")

    @app.post("/deploy_files")
    def deploy_files() -> dict:
        return {"deployed": True}

    @app.post("/undeploy/{name}")
    def undeploy(name: str) -> dict:
        return {"undeployed": name}

    app.add_middleware(
        ApiAuthMiddleware, token=TOKEN, pipelines=["my_pipeline"], allow_docs=allow_docs
    )
    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(build_app())


def test_health_is_public(client):
    assert client.get("/health").status_code == 200


def test_pipeline_run_requires_token(client):
    assert client.post("/my_pipeline/run", json={}).status_code == 401
    response = client.post("/my_pipeline/run", json={}, headers=AUTH)
    assert response.status_code == 200
    assert response.json() == {"result": "ran"}


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer wrong-token"},
        {"Authorization": f"Basic {TOKEN}"},
        {"Authorization": TOKEN},
        {"Authorization": "Bearer "},
    ],
)
def test_bad_credentials_are_rejected(client, headers):
    response = client.post("/my_pipeline/run", json={}, headers=headers)
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_bearer_scheme_is_case_insensitive(client):
    headers = {"Authorization": f"bearer {TOKEN}"}
    assert client.post("/my_pipeline/run", json={}, headers=headers).status_code == 200


def test_streaming_passes_through(client):
    response = client.post("/chat/completions", json={}, headers=AUTH)
    assert response.status_code == 200
    assert response.text == "data: one\n\ndata: two\n\n"


@pytest.mark.parametrize(
    "method, path",
    [
        ("POST", "/deploy_files"),
        ("POST", "/undeploy/my_pipeline"),
        # A pipeline literally named "run" must not expose /undeploy/run
        ("POST", "/undeploy/run"),
        ("POST", "/other_pipeline/run"),
        ("GET", "/my_pipeline/run"),
        ("POST", "/health"),
        ("GET", "/docs"),
        ("GET", "/openapi.json"),
    ],
)
def test_unlisted_routes_are_not_found_even_with_token(client, method, path):
    assert client.request(method, path, headers=AUTH).status_code == 404


def test_docs_reachable_when_allowed():
    client = TestClient(build_app(allow_docs=True))
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_empty_token_is_refused():
    with pytest.raises(ValueError):
        ApiAuthMiddleware(FastAPI(), token="", pipelines=[])


def test_pipeline_names(tmp_path):
    (tmp_path / "pipeline_a").mkdir()
    (tmp_path / "pipeline_a" / "pipeline_wrapper.py").touch()
    (tmp_path / "not_a_pipeline").mkdir()
    (tmp_path / "README.md").touch()
    assert pipeline_names(tmp_path) == {"pipeline_a"}


def test_app_pipelines_are_found():
    names = pipeline_names("src/pipelines")
    assert {"generate_referrals_rag", "generate_action_plan", "email_responses"} <= names


def test_hayhooks_routes_are_blocked(monkeypatch, tmp_path):
    """Every route the real Hayhooks app registers is refused unless allow-listed.

    Guards against a Hayhooks upgrade adding new management routes.
    """
    monkeypatch.setattr(hayhooks_settings, "pipelines_dir", str(tmp_path))
    app = create_app()
    # Read the full route table before the middleware hides /openapi.json
    with TestClient(app) as unprotected:
        openapi = unprotected.get("/openapi.json").json()
    routes = [(method.upper(), path) for path, ops in openapi["paths"].items() for method in ops]
    assert ("POST", "/deploy_files") in routes, "expected Hayhooks management routes"

    app = create_app()
    app.add_middleware(ApiAuthMiddleware, token=TOKEN, pipelines=[])
    with TestClient(app) as client:
        for method, path in routes:
            # Fill path params with a placeholder
            concrete = re.sub(r"\{[^}]+\}", "x", path)
            expected = 401 if (method, concrete) == ("POST", "/chat/completions") else 404
            assert client.request(method, concrete).status_code == expected, (method, path)
            if expected == 404:
                assert client.request(method, concrete, headers=AUTH).status_code == 404
