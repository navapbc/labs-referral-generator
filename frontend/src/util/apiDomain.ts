import "server-only";

// Base URL of the backend API, configured per environment via API_BASE_URL.
// Only the server-side proxy (src/app/api/hayhooks) calls the backend, so this
// never reaches the browser.
// - Local: defaults to http://0.0.0.0:3000/ when ENVIRONMENT is unset or "local".
// - Deployed environments: set in
//   infra/frontend/app-config/env-config/environment_variables.tf
//   or overridden per-env in infra/frontend/app-config/<env>.tf.
// NEXT_PUBLIC_API_BASE_URL is still read for existing local .env.local files.
export function getApiDomain(): string {
  const apiBaseUrl =
    process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBaseUrl) return apiBaseUrl;

  const environment = process.env.ENVIRONMENT ?? "local";
  if (environment === "local") return "http://0.0.0.0:3000/";

  throw new Error(`API_BASE_URL must be set when ENVIRONMENT=${environment}`);
}
