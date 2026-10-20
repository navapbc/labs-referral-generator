/**
 * @jest-environment node
 */
import { POST } from "src/app/api/hayhooks/[...path]/route";

// server-only throws outside a React Server environment
jest.mock("server-only", () => ({}));

const callProxy = (path: string[], init: RequestInit = {}) =>
  POST(
    new Request(`http://localhost/api/hayhooks/${path.join("/")}`, {
      method: "POST",
      ...init,
    }),
    { params: Promise.resolve({ path }) },
  );

describe("hayhooks API proxy", () => {
  const originalEnv = process.env;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      API_AUTH_TOKEN: "secret-token",
      API_BASE_URL: "http://api.internal/",
    };
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json", "x-internal": "1" },
      }),
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchSpy.mockRestore();
  });

  it("forwards allow-listed paths with the bearer token", async () => {
    const response = await callProxy(["generate_action_plan", "run"], {
      headers: { "content-type": "application/json" },
      body: '{"user_query":"food"}',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"ok":true}');
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.internal/generate_action_plan/run");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer secret-token");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("only passes through allow-listed response headers", async () => {
    const response = await callProxy(["chat", "completions"]);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-internal")).toBeNull();
  });

  it("passes through the backend's status code", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 422 }));
    const response = await callProxy(["email_responses", "run"]);
    expect(response.status).toBe(422);
  });

  it.each([
    [["deploy_files"]],
    [["undeploy", "generate_action_plan"]],
    [["v1", "files"]],
    [["traces"]],
    [["unknown_pipeline", "run"]],
    [["..", "deploy_files"]],
  ])("refuses %j without calling the backend", async (path) => {
    const response = await callProxy(path);
    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the token is not configured", async () => {
    delete process.env.API_AUTH_TOKEN;
    const response = await callProxy(["generate_action_plan", "run"]);
    expect(response.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 502 when the backend is unreachable", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    const response = await callProxy(["generate_action_plan", "run"]);
    expect(response.status).toBe(502);
  });
});
