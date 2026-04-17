import { useState, useRef, useCallback } from "react";
import { Resource } from "@/types/resources";
import { PartialResource } from "@/util/parseStreamingResources";
import { fetchResourcesStreaming } from "@/util/fetchResourcesStreaming";
import {
  buildRequestWithResolvedZipCodes,
  RequestParams,
} from "@/util/resolveZipCodes";
import { NO_RESOURCES_TIMEOUT } from "@/config/timeouts";

export interface UseResourcesStreamingReturn {
  loading: boolean;
  isStreamingResources: boolean;
  hasReceivedFirstResource: boolean;
  streamingResources: PartialResource[] | null;
  errorMessage: string | undefined;
  findResources: (
    params: RequestParams,
    userEmail: string,
    additionalParams?: {
      prompt_version_id?: string | null;
      suffix?: string;
    },
  ) => Promise<{
    resources: Resource[];
    resultId: string;
    documents: string[];
    errorMessage?: string;
  }>;
  setErrorMessage: (error: string | undefined) => void;
  abort: () => void;
}

/**
 * Custom hook to handle resource streaming with SSE
 */
export function useResourcesStreaming(): UseResourcesStreamingReturn {
  const [loading, setLoading] = useState(false);
  const [isStreamingResources, setIsStreamingResources] = useState(false);
  const [hasReceivedFirstResource, setHasReceivedFirstResource] =
    useState(false);
  const hasReceivedFirstResourceRef = useRef(false);
  const [streamingResources, setStreamingResources] = useState<
    PartialResource[] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const findResources = useCallback(
    async (
      params: RequestParams,
      userEmail: string,
      additionalParams?: {
        prompt_version_id?: string | null;
        suffix?: string;
      },
    ) => {
      const { prompt_version_id = null, suffix } = additionalParams ?? {};

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setIsStreamingResources(true);
      setHasReceivedFirstResource(false);
      hasReceivedFirstResourceRef.current = false;
      setStreamingResources(null);
      setErrorMessage(undefined);

      // Show "No resources found" if nothing arrives within timeout period - 12 seconds
      const timeoutId = setTimeout(() => {
        if (!hasReceivedFirstResourceRef.current) {
          setErrorMessage("No resources found.");
          setIsStreamingResources(false);
          setLoading(false);
        }
      }, NO_RESOURCES_TIMEOUT);

      try {
        const request = await buildRequestWithResolvedZipCodes(params);

        const {
          resources: finalResources,
          resultId,
          documents,
          errorMessage: streamError,
        } = await fetchResourcesStreaming(
          request,
          userEmail,
          // onChunk callback - receive partial resources
          (partialResources: PartialResource[]) => {
            if (
              partialResources.length > 0 &&
              !hasReceivedFirstResourceRef.current
            ) {
              hasReceivedFirstResourceRef.current = true;
              setHasReceivedFirstResource(true);
              clearTimeout(timeoutId);
            }
            setStreamingResources(partialResources);
          },
          // onComplete callback - stop streaming UI
          () => {
            setIsStreamingResources(false);
          },
          // onError callback - clear content and show error
          (error: string) => {
            setIsStreamingResources(false);
            setLoading(false);
            setStreamingResources(null);
            setErrorMessage(error);
          },
          prompt_version_id,
          suffix,
          abortControllerRef.current,
        );

        // Clear the timeout when streaming completes
        clearTimeout(timeoutId);

        // Handle errors from the streaming response
        if (streamError) {
          setErrorMessage(streamError);
          setStreamingResources(null);
          return {
            resources: [],
            resultId: "",
            documents: [],
            errorMessage: streamError,
          };
        }

        // Set the final parsed resources
        if (finalResources) {
          setErrorMessage(undefined);
          setStreamingResources(null); // Clear streaming state
          return {
            resources: finalResources,
            resultId,
            documents,
          };
        } else {
          const errorMsg =
            "There was an issue streaming the resources. Please try again.";
          setErrorMessage(errorMsg);
          return {
            resources: [],
            resultId: "",
            documents: [],
            errorMessage: errorMsg,
          };
        }
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error(message);
        setIsStreamingResources(false);
        setStreamingResources(null);
        const errorMsg =
          "There was an issue streaming the resources. Please try again.";
        setErrorMessage(errorMsg);
        return {
          resources: [],
          resultId: "",
          documents: [],
          errorMessage: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    isStreamingResources,
    hasReceivedFirstResource,
    streamingResources,
    errorMessage,
    findResources,
    setErrorMessage,
    abort: () => {
      abortControllerRef.current?.abort();
    },
  };
}
