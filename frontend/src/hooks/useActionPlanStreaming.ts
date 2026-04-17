import { useState, useCallback, useRef } from "react";
import { Resource } from "@/types/resources";
import {
  ActionPlan,
  PartialActionPlan,
  fetchActionPlanStreaming,
} from "@/util/fetchActionPlan";

export interface UseActionPlanStreamingReturn {
  isGeneratingActionPlan: boolean;
  isStreamingActionPlan: boolean;
  streamingPlan: PartialActionPlan | null;
  actionPlan: ActionPlan | null;
  errorMessage: string | undefined;
  generateActionPlan: (
    selectedResources: Resource[],
    userEmail: string,
    clientDescription: string,
    contextDocuments?: string[],
  ) => Promise<{
    actionPlan: ActionPlan | null;
    resultId: string;
    errorMessage?: string;
  }>;
  setErrorMessage: (error: string | undefined) => void;
  clearActionPlan: () => void;
  abort: () => void;
}

/**
 * Custom hook to handle action plan streaming with SSE
 */
export function useActionPlanStreaming(): UseActionPlanStreamingReturn {
  const [isGeneratingActionPlan, setIsGeneratingActionPlan] = useState(false);
  const [isStreamingActionPlan, setIsStreamingActionPlan] = useState(false);
  const [streamingPlan, setStreamingPlan] = useState<PartialActionPlan | null>(
    null,
  );
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateActionPlan = useCallback(
    async (
      selectedResources: Resource[],
      userEmail: string,
      clientDescription: string,
      contextDocuments?: string[],
    ) => {
      if (selectedResources.length === 0) {
        return {
          actionPlan: null,
          resultId: "",
          errorMessage: "No resources selected",
        };
      }

      abortControllerRef.current = new AbortController();
      setIsGeneratingActionPlan(true);
      setIsStreamingActionPlan(true);
      setActionPlan(null);
      setStreamingPlan(null);
      setErrorMessage(undefined);

      try {
        const {
          actionPlan: finalPlan,
          resultId,
          errorMessage: planError,
        } = await fetchActionPlanStreaming(
          selectedResources,
          userEmail,
          clientDescription,
          // onChunk callback - receive structured partial plan
          (partialPlan: PartialActionPlan) => {
            setStreamingPlan(partialPlan);
          },
          // onComplete callback - stop streaming UI
          () => {
            setIsStreamingActionPlan(false);
          },
          // onError callback - clear content and show error
          (error: string) => {
            setIsStreamingActionPlan(false);
            setIsGeneratingActionPlan(false);
            setStreamingPlan(null);
            setActionPlan(null);
            setErrorMessage(error);
          },
          contextDocuments,
          abortControllerRef.current,
        );

        // Handle errors from the streaming response
        if (planError) {
          setErrorMessage(planError);
          setStreamingPlan(null);
          setActionPlan(null);
          return {
            actionPlan: null,
            resultId: "",
            errorMessage: planError,
          };
        }

        // Set the final parsed action plan
        if (finalPlan) {
          setActionPlan(finalPlan);
          setStreamingPlan(null); // Clear streaming state
          return {
            actionPlan: finalPlan,
            resultId,
          };
        } else {
          const errorMsg =
            "There was an issue streaming the Action Plan. Please try again.";
          setErrorMessage(errorMsg);
          return {
            actionPlan: null,
            resultId: "",
            errorMessage: errorMsg,
          };
        }
      } catch (error) {
        console.error("Error generating action plan:", error);
        setIsStreamingActionPlan(false);
        setIsGeneratingActionPlan(false);
        setStreamingPlan(null);
        setActionPlan(null);
        const errorMsg =
          "There was an issue streaming the Action Plan. Please try again.";
        setErrorMessage(errorMsg);
        return {
          actionPlan: null,
          resultId: "",
          errorMessage: errorMsg,
        };
      } finally {
        setIsGeneratingActionPlan(false);
      }
    },
    [],
  );

  const clearActionPlan = useCallback(() => {
    abortControllerRef.current?.abort();
    setActionPlan(null);
    setStreamingPlan(null);
    setIsStreamingActionPlan(false);
    setIsGeneratingActionPlan(false);
    setErrorMessage(undefined);
  }, []);

  return {
    isGeneratingActionPlan,
    isStreamingActionPlan,
    streamingPlan,
    actionPlan,
    errorMessage,
    generateActionPlan,
    setErrorMessage,
    clearActionPlan,
    abort: () => {
      abortControllerRef.current?.abort();
    },
  };
}
