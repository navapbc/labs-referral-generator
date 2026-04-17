"use server";

// API base URL is configured per environment via NEXT_PUBLIC_API_BASE_URL.
// - Local: defaults to http://0.0.0.0:3000/ when ENVIRONMENT is unset or "local".
// - Deployed environments: set in
//   infra/frontend/app-config/env-config/environment_variables.tf
//   or overridden per-env in infra/frontend/app-config/<env>.tf.
// eslint-disable-next-line @typescript-eslint/require-await
export async function getApiDomain(): Promise<string> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (apiBaseUrl) return apiBaseUrl;

  const environment = process.env.ENVIRONMENT ?? "local";
  if (environment === "local") return "http://0.0.0.0:3000/";

  throw new Error(
    `NEXT_PUBLIC_API_BASE_URL must be set when ENVIRONMENT=${environment}`,
  );
}
