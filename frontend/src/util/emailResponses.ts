import { getApiDomain } from "./apiDomain";
import { ApiErrorResponse, EmailResponsesResponse } from "@/types/api";
import { ShareMode } from "@/components/ShareOptionsDialog";
import { EMAIL_TIMEOUT } from "@/config/timeouts";

/**
 * Sends an email with resources, action plan, or both using the consolidated email_responses endpoint.
 *
 * @param resultId - ID of the resources result (optional if action plan provided)
 * @param actionPlanResultId - ID of the action plan result (optional if resources provided)
 * @param recipient_email - Recipient email address
 * @param requestor_email - Email address of the person requesting the share
 * @param mode - Share mode determining what content to include
 * @param excludedResourceNames - Optional array of resource names to exclude from the email
 * @returns Promise with email address confirmation
 *
 * Scenarios:
 * - action-plan-only: Sends only the action plan
 * - full-referrals: Sends both resources and action plan
 * - default: Sends only resources
 */
export async function emailResponses(
  resultId: string | undefined,
  actionPlanResultId: string | undefined,
  recipientEmail: string,
  requestorEmail: string,
  mode?: ShareMode,
  excludedResourceNames?: string[],
) {
  const apiDomain = await getApiDomain();

  // Use consolidated endpoint for all scenarios
  const endpoint = "email_responses";

  // Build request body based on mode - include only the relevant result IDs
  const body: Record<string, string | string[]> = {
    recipient_email: recipientEmail,
  };
  body.requestor_email = requestorEmail;

  // Explicitly handle each scenario
  if (mode === "action-plan-only") {
    // Action plan only - send ONLY action_plan_result_id
    if (!actionPlanResultId) {
      throw new Error(
        "Action plan result ID is required for action-plan-only mode",
      );
    }
    body.action_plan_result_id = actionPlanResultId;
  } else if (mode === "full-referrals") {
    // Full referrals - send BOTH result IDs
    if (!actionPlanResultId) {
      throw new Error(
        "Action plan result ID is required for full-referrals mode",
      );
    }
    if (!resultId) {
      throw new Error("Resource result ID is required for full-referrals mode");
    }
    body.resources_result_id = resultId;
    body.action_plan_result_id = actionPlanResultId;
  } else {
    // Resources only (default) - send ONLY resources_result_id
    if (!resultId) {
      throw new Error("Resource result ID is required for resources-only mode");
    }
    body.resources_result_id = resultId;
  }

  // Add excluded resource names if provided
  if (excludedResourceNames && excludedResourceNames.length > 0) {
    body.excluded_resource_names = excludedResourceNames;
  }

  const url = `${apiDomain}${endpoint}/run`;

  const headers = {
    "Content-Type": "application/json",
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), EMAIL_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ac.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errorMessage: string;

      try {
        const errorData = (await response.json()) as ApiErrorResponse;
        // Try multiple possible error message fields
        errorMessage =
          errorData.message ||
          errorData.error ||
          errorData.detail ||
          errorData.result?.error ||
          errorData.result?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
      } catch (e) {
        // If JSON parsing fails, use status text
        const errorStr = e instanceof Error ? e.message : String(e);
        errorMessage = `HTTP ${response.status}: ${response.statusText} (${errorStr})`;
      }

      throw new Error(errorMessage);
    }

    // Parse unified response from email_responses endpoint
    const responseData = (await response.json()) as EmailResponsesResponse;
    const emailAddress = responseData.result.email_responses.email;
    return { emailAddr: emailAddress };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to send email");
  }
}
