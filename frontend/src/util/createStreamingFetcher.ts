/**
 * Generic utility for creating streaming fetch functions with SSE support.
 * Handles abort controllers, timeouts, and SSE parsing.
 */

import { STREAMING_TIMEOUT } from "@/config/timeouts";

export interface StreamingConfig<T, TPartial> {
  /** The API endpoint URL */
  url: string;
  /** Timeout in milliseconds (default: STREAMING_TIMEOUT = 10 minutes) */
  timeout?: number;
  /** Request body to send */
  requestBody: Record<string, unknown>;
  /** Callback called for each chunk of partial data */
  onChunk: (partial: TPartial) => void;
  /** Callback called when streaming completes successfully */
  onComplete: () => void;
  /** Callback called when an error occurs */
  onError: (error: string) => void;
  /** Function to parse accumulated JSON into partial data for progressive display */
  parsePartial: (accumulatedJson: string) => TPartial;
  /** Function to parse final accumulated JSON into complete result */
  parseFinal: (accumulatedJson: string) => T;
  /** Optional function to determine if content should be accumulated (default: always true) */
  shouldAccumulateContent?: (content: string) => boolean;
  /** Called with non-accumulated content chunks (e.g. metadata excluded by shouldAccumulateContent) */
  extractMetadata?: (content: string) => void;
  /** Optional external AbortController. If provided, its signal is used instead of creating an internal one. */
  abortController?: AbortController;
}

export interface StreamingResult<T> {
  data: T | null;
  resultId: string;
  errorMessage?: string;
}

/**
 * Creates a streaming fetcher that handles SSE parsing, timeouts, and error handling.
 * Returns a reusable fetch function.
 */
export async function createStreamingFetcher<T, TPartial>(
  config: StreamingConfig<T, TPartial>,
): Promise<StreamingResult<T>> {
  const {
    url,
    timeout = STREAMING_TIMEOUT,
    requestBody,
    onChunk,
    onComplete,
    onError,
    parsePartial,
    parseFinal,
    shouldAccumulateContent = () => true,
    extractMetadata,
  } = config;

  const ac = config.abortController ?? new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);

  let resultId = "";
  let hasError = false;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: ac.signal,
    });

    if (!response.ok) {
      clearTimeout(timer);
      const errMsg = `Request failed with status ${response.status}`;
      onError(errMsg);
      return {
        data: null,
        resultId: "",
        errorMessage: errMsg,
      };
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      clearTimeout(timer);
      const errMsg = "Response body is null";
      onError(errMsg);
      return {
        data: null,
        resultId: "",
        errorMessage: errMsg,
      };
    }

    let buffer = "";
    let accumulatedJSON = "";
    let lastChunkContent = "";
    let streamComplete = false;

    while (true) {
      // Check if we should stop before blocking on read()
      if (ac.signal.aborted || streamComplete) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]" || !data) {
            continue;
          }

          try {
            const parsed = JSON.parse(data) as {
              error?: string;
              result_id?: string;
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string;
              }>;
            };

            // Check for error in the response
            if (parsed.error) {
              clearTimeout(timer);
              hasError = true;
              errorMessage = parsed.error;
              onError(parsed.error);
              return {
                data: null,
                resultId: "",
                errorMessage: parsed.error,
              };
            }

            // Extract result_id if present
            if (parsed.result_id) {
              resultId = parsed.result_id;
            }

            // Handle hayhooks response format: choices[0].delta.content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              lastChunkContent = content;

              // Check if we should accumulate this content
              if (shouldAccumulateContent(content)) {
                accumulatedJSON += content;

                // Parse incrementally and pass structured data to callback
                try {
                  const partialData = parsePartial(accumulatedJSON);
                  onChunk(partialData);
                } catch {
                  // Partial parse errors are expected during streaming
                  // Continue accumulating
                }
              } else {
                extractMetadata?.(content);
              }
            }

            // Check for finish_reason to detect completion
            if (parsed.choices?.[0]?.finish_reason === "stop") {
              // Extract result_id from the last chunk if not already set
              if (!resultId && lastChunkContent.includes("result_id")) {
                try {
                  const resultIdData = JSON.parse(lastChunkContent) as {
                    result_id?: string;
                  };
                  if (resultIdData.result_id) {
                    resultId = resultIdData.result_id;
                  }
                } catch (e) {
                  console.error(
                    "Failed to extract result_id from last chunk:",
                    e,
                  );
                }
              }

              streamComplete = true;
              break;
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e, data);
          }
        }
      }
    }

    // Single cleanup point after loop exit
    clearTimeout(timer);
    reader.releaseLock();
    if (!hasError && !ac.signal.aborted) {
      onComplete();
    }

    // Parse the final accumulated JSON to get complete result
    let finalData: T | null = null;

    if (!hasError && accumulatedJSON) {
      try {
        finalData = parseFinal(accumulatedJSON);
      } catch (e) {
        console.error("Failed to parse final JSON:", e);
        console.error("Raw accumulated JSON:", accumulatedJSON);
        errorMessage = "Failed to parse the response. Please try again.";
        hasError = true;
        onError(errorMessage);
        return {
          data: null,
          resultId: resultId,
          errorMessage,
        };
      }
    }

    return {
      data: finalData,
      resultId: resultId,
      errorMessage: hasError ? errorMessage : undefined,
    };
  } catch (error) {
    clearTimeout(timer);
    let errMsg =
      "The server encountered an unexpected error. Please try again later.";

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errMsg = "Request timed out, please try again.";
      } else {
        errMsg =
          "The server encountered an unexpected error. Please try again later.";
      }
    }

    onError(errMsg);
    return {
      data: null,
      resultId: "",
      errorMessage: errMsg,
    };
  }
}
