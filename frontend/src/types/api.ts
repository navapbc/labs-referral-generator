/**
 * Type definitions for API responses from the backend.
 * These interfaces map to the deeply nested response structures.
 */

/**
 * Common save_result structure used across multiple endpoints
 */
export interface SaveResult {
  result_id: string;
}

/**
 * Content item in LLM replies
 */
export interface LLMContent {
  text: string;
  _content?: unknown[];
}

/**
 * Reply structure from LLM
 */
export interface LLMReply {
  _content: LLMContent[];
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  replies: LLMReply[];
}

/**
 * Response from generate_referrals/run and generate_referrals_rag/run endpoints
 */
export interface GenerateReferralsResponse {
  result: {
    save_result: SaveResult;
    llm: LLMResponse;
  };
}

/**
 * Response from generate_referrals_from_doc/run endpoint
 */
export interface GenerateReferralsFromDocResponse {
  result: {
    llm: LLMResponse;
  };
}

/**
 * Response from generate_action_plan/run endpoint
 */
export interface GenerateActionPlanResponse {
  result: {
    save_result: SaveResult;
    response: string;
  };
}

/**
 * Email result structure
 */
export interface EmailResultData {
  email: string;
}

/**
 * Response from email_responses/run endpoint (consolidated email pipeline)
 * Replaces the deprecated email_result, email_full_result, and email_action_plan endpoints
 */
export interface EmailResponsesResponse {
  result: {
    email_responses: EmailResultData;
  };
}

/**
 * Generic error response structure
 */
export interface ApiErrorResponse {
  message?: string;
  error?: string;
  detail?: string;
  result?: {
    error?: string;
    message?: string;
  };
}
