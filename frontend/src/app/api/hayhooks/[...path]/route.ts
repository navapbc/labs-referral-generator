/**
 * Server-side proxy to the backend (Hayhooks) API.
 *
 * The browser calls /api/hayhooks/<path>; this handler forwards the request to
 * API_BASE_URL with the API's bearer token, which never reaches the browser,
 * and streams the response back unchanged (including SSE from chat/completions).
 */
import { NextResponse } from "next/server";
import { getApiDomain } from "@/util/apiDomain";

// Backend endpoints the frontend uses. Anything else is refused here, before
// the backend's own allow-list.
const ALLOWED_PATHS = new Set([
  "chat/completions",
  "email_responses/run",
  "generate_action_plan/run",
  "generate_referrals/run",
  "generate_referrals_from_doc/run",
  "generate_referrals_rag/run",
]);

// Response headers worth passing through to the browser
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control"];

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const apiPath = path.join("/");
  if (!ALLOWED_PATHS.has(apiPath)) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  const token = process.env.API_AUTH_TOKEN;
  if (!token) {
    console.error("API_AUTH_TOKEN is not set; cannot call the backend API");
    return NextResponse.json(
      { detail: "The API proxy is not configured" },
      { status: 500 },
    );
  }

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  // Keep the multipart boundary for file uploads
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let upstream: Response;
  try {
    upstream = await fetch(getApiDomain() + apiPath, {
      method: "POST",
      headers,
      body: request.body,
      // Required by Node's fetch to send a streaming request body
      duplex: "half",
      cache: "no-store",
      // Cancel the backend request (and its LLM calls) if the browser goes away
      signal: request.signal,
    } as RequestInit & { duplex: "half" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("Backend API request failed:", error);
    return NextResponse.json(
      { detail: "The backend API is unavailable" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
