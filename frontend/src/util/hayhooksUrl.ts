/**
 * URL of a backend API endpoint, via the frontend's server-side proxy
 * (src/app/api/hayhooks), which adds the API's auth token.
 * @param path - Backend path without a leading slash, e.g. "generate_action_plan/run"
 */
export function hayhooksUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/hayhooks/${path}`;
}
