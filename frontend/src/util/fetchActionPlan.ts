import { Resource } from "@/types/resources";
import { getApiDomain } from "./apiDomain";
import { fixJsonControlCharacters, extractField } from "./parseStreamingUtils";
import { createStreamingFetcher } from "./createStreamingFetcher";
import { GenerateActionPlanResponse } from "@/types/api";
import { ACTION_PLAN_TIMEOUT, STREAMING_TIMEOUT } from "@/config/timeouts";

export interface ActionPlan {
  title: string;
  summary: string;
  content: string;
}

export interface PartialActionPlan {
  title: string;
  summary: string;
  content: string;
}

/**
 * Parses streaming JSON to extract title, summary, and content fields
 * Handles incomplete JSON gracefully - captures partial strings even without closing quotes
 * Properly handles escaped characters like \", \n, etc.
 */
function parseStreamingJSON(jsonStr: string): PartialActionPlan {
  const title = extractField(jsonStr, "title") || "";
  const summary = extractField(jsonStr, "summary") || "";
  const content = extractField(jsonStr, "content") || "";

  return { title, summary, content };
}

export async function fetchActionPlan(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
  contextDocuments?: string[],
): Promise<{
  actionPlan: ActionPlan | null;
  resultId: string;
  errorMessage?: string;
}> {
  const apiDomain = await getApiDomain();
  const url = apiDomain + "generate_action_plan/run";
  const headers = {
    "Content-Type": "application/json",
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ACTION_PLAN_TIMEOUT);

  try {
    const requestBody: {
      resources: Resource[];
      user_email: string;
      user_query: string;
      context_documents?: string[];
    } = {
      resources: resources,
      user_email: userEmail,
      user_query: userQuery,
      ...(contextDocuments?.length
        ? { context_documents: contextDocuments }
        : {}),
    };

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: ac.signal,
    });

    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("Failed to generate action plan:", upstream.statusText);
      return {
        actionPlan: null,
        resultId: "",
        errorMessage:
          "The server encountered an unexpected error. Please try again later.",
      };
    }

    const responseData = (await upstream.json()) as GenerateActionPlanResponse;
    // Extract the result ID from the API response
    const resultUuid = responseData.result.save_result.result_id;
    // Extract the action plan from the API response
    const actionPlanText = responseData.result.response;
    console.log("Raw action plan text:", actionPlanText);

    // The LLM likes to return a multi-line JSON string, so
    // escape these characters or JSON.parse will fail
    const fixedJson = fixJsonControlCharacters(actionPlanText);
    const actionPlan = JSON.parse(fixedJson) as ActionPlan;

    return { actionPlan, resultId: resultUuid };
  } catch (error) {
    clearTimeout(timer);
    // Check if the error is due to timeout
    if (error instanceof Error && error.name === "AbortError") {
      return {
        actionPlan: null,
        resultId: "",
        errorMessage: "Request timed out, please try again.",
      };
    }
  }
  // Generic error handling
  console.error("Error fetching action plan");
  clearTimeout(timer);
  return {
    actionPlan: null,
    resultId: "",
    errorMessage:
      "The server encountered an unexpected error. Please try again later.",
  };
}

/**
 * Fetches action plan with streaming support using Server-Sent Events (SSE).
 * Calls onChunk with parsed structured data for progressive display.
 * Returns the same structure as fetchActionPlan for consistency.
 */
export async function fetchActionPlanStreaming(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
  onChunk: (partialPlan: PartialActionPlan) => void,
  onComplete: () => void,
  onError: (error: string) => void,
  contextDocuments?: string[],
  abortController?: AbortController,
): Promise<{
  actionPlan: ActionPlan | null;
  resultId: string;
  errorMessage?: string;
}> {
  const apiDomain = await getApiDomain();
  const url = `${apiDomain}chat/completions`;

  const result = await createStreamingFetcher<ActionPlan, PartialActionPlan>({
    url,
    timeout: STREAMING_TIMEOUT, // 10 minutes
    abortController,
    requestBody: {
      model: "generate_action_plan", // Pipeline name as model
      messages: [{ role: "user", content: userQuery }],
      stream: true,
      resources: resources,
      user_email: userEmail,
      user_query: userQuery,
      ...(contextDocuments?.length
        ? { context_documents: contextDocuments }
        : {}),
    },
    onChunk,
    onComplete,
    onError: (error: string) => {
      // Customize error message for action plan
      const customError =
        error ===
        "The server encountered an unexpected error. Please try again later."
          ? "There was an issue streaming the Action Plan. Please try again."
          : error === "Request timed out, please try again."
            ? "Request timed out. Please try again."
            : error;
      onError(customError);
    },
    shouldAccumulateContent: (content) => !content.includes("result_id"),
    parsePartial: (accumulatedJson) => {
      return parseStreamingJSON(accumulatedJson);
    },
    parseFinal: (accumulatedJson) => {
      const fixedJson = fixJsonControlCharacters(accumulatedJson);
      return JSON.parse(fixedJson) as ActionPlan;
    },
  });

  return {
    actionPlan: result.data,
    resultId: result.resultId,
    errorMessage: result.errorMessage,
  };
}
