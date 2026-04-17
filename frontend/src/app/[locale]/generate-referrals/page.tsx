"use client";
import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Resource } from "@/types/resources";
import "@/app/globals.css";

import { PrintableReferralsReport } from "@/util/printReferrals";
import { PrintOptionsDialog, PrintMode } from "@/components/PrintOptionsDialog";
import { ActionPlanSection } from "@/components/ActionPlanSection";

import ResourcesList from "@/components/ResourcesList";
import { useSearchParams } from "next/navigation";
import { ShareButtons } from "@/components/ShareButtons";

import WelcomeUserInputScreen from "@/components/WelcomeUserInputScreen";
import { ReferralGeneratorHeader } from "@/components/ReferralGeneratorHeader";
import { ClientDetailsInput } from "@/components/ClientDetailsInput";
import { RefinePromptPanel } from "@/components/RefinePromptPanel";
import { RemoveResourceNotification } from "@/components/RemoveResourceNotification";

// Custom hooks
import { useResourcesStreaming } from "@/hooks/useResourcesStreaming";
import { useActionPlanStreaming } from "@/hooks/useActionPlanStreaming";
import { useResourceRemoval } from "@/hooks/useResourceRemoval";

export default function Page() {
  const searchParams = useSearchParams();

  // ========== User State ==========
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isCheckingUser, setIsCheckingUser] = useState(true);

  // ========== Form/Input State ==========
  const [clientDescription, setClientDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(
    [],
  );

  // ========== Results State ==========
  const [retainedResources, setRetainedResources] = useState<Resource[]>();
  const [resourcesResultId, setResourcesResultId] = useState("");
  const [showResultsView, setShowResultsView] = useState(false);
  const [excludedResourceNames, setExcludedResourceNames] = useState<string[]>(
    [],
  );
  // RAG source documents — invisible to user, passed to action plan LLM as context
  const [contextDocuments, setContextDocuments] = useState<string[]>([]);

  // ========== Resources Streaming (Custom Hook) ==========
  /**
   * STREAMING STATE LIFECYCLE:
   *
   * The streaming process follows these state transitions:
   *
   * 1. INITIAL STATE (before search):
   *    - loading: false
   *    - isStreamingResources: false
   *    - hasReceivedFirstResource: false
   *    - streamingResources: null
   *    - retainedResources: undefined
   *
   * 2. LOADING STATE (search initiated):
   *    - loading: true (triggers loading UI)
   *    - isStreamingResources: true
   *    - showResultsView: true
   *    - Starts 12-second timeout to show "No resources found" if nothing arrives
   *
   * 3. STREAMING STATE (first chunk arrives):
   *    - hasReceivedFirstResource: true (clears "No resources found" timeout)
   *    - streamingResources: PartialResource[] (updates with each chunk)
   *    - ResourcesList displays streamingResources with loading skeleton for incomplete data
   *
   * 4. STREAM COMPLETE STATE:
   *    - isStreamingResources: false
   *    - streamingResources: null (cleared)
   *    - retainedResources: Resource[] (final validated resources)
   *    - ResourcesList switches to displaying retainedResources
   *
   * 5. ERROR STATE (at any point):
   *    - isStreamingResources: false
   *    - loading: false
   *    - streamingResources: null
   *    - errorMessage: string (displayed in ResourcesList)
   *
   * State management notes:
   * - streamingResources are partial/incomplete, retainedResources are final/complete
   * - retainedResources is user-editable (can remove items), streamingResources is read-only
   * - The hook manages streaming lifecycle, this component manages retained results
   */
  const {
    loading,
    isStreamingResources,
    hasReceivedFirstResource,
    streamingResources,
    errorMessage: resourcesError,
    findResources: findResourcesFromHook,
    setErrorMessage: setResourcesError,
    abort: abortResources,
  } = useResourcesStreaming();

  // ========== Action Plan State ==========
  const [selectedResources, setSelectedResources] = useState<Resource[]>([]);
  const [actionPlanResultId, setActionPlanResultId] = useState("");

  // ========== Action Plan Streaming (Custom Hook) ==========
  const {
    isGeneratingActionPlan,
    isStreamingActionPlan,
    streamingPlan,
    actionPlan,
    errorMessage: actionPlanError,
    generateActionPlan: generateActionPlanFromHook,
    setErrorMessage: setActionPlanError,
    clearActionPlan,
    abort: abortActionPlan,
  } = useActionPlanStreaming();

  // ========== Resource Removal (Custom Hook) ==========
  const {
    recentlyRemoved,
    handleRemoveResource: handleRemoveFromHook,
    handleUndoRemove: handleUndoFromHook,
  } = useResourceRemoval();

  // ========== UI State ==========
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("full-referrals");

  // Combine error messages from both hooks
  const errorMessage = resourcesError || actionPlanError;

  // Check if user has provided info on first load
  useEffect(() => {
    const storedUserName = localStorage.getItem("userName");
    const storedUserEmail = localStorage.getItem("userEmail");

    if (storedUserName && storedUserEmail) {
      setUserName(storedUserName);
      setUserEmail(storedUserEmail);
    }
    setIsCheckingUser(false);
  }, []);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setLocationText("");
    setSelectedResourceTypes([]);
  };

  const toggleResourceType = (type: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const onResources = (resources: Resource[]) => {
    setRetainedResources(resources); // this creates a copy of the original list of resources, may be edited by the user
    setShowResultsView(true);
  };

  async function findResources(overrides?: {
    clientDescription?: string;
    locationText?: string;
    selectedCategories?: string[];
    selectedResourceTypes?: string[];
  }) {
    const prompt_version_id = searchParams?.get("prompt_version_id") ?? null;
    const suffix = searchParams?.get("suffix") ?? undefined;

    // Use overrides if provided, otherwise use state values
    const effectiveClientDescription =
      overrides?.clientDescription ?? clientDescription;
    const effectiveLocationText = overrides?.locationText ?? locationText;
    const effectiveSelectedCategories =
      overrides?.selectedCategories ?? selectedCategories;
    const effectiveSelectedResourceTypes =
      overrides?.selectedResourceTypes ?? selectedResourceTypes;

    setResourcesError(undefined);
    setExcludedResourceNames([]);
    setShowResultsView(true);

    const {
      resources,
      resultId,
      documents,
      errorMessage: streamError,
    } = await findResourcesFromHook(
      {
        clientDescription: effectiveClientDescription,
        locationText: effectiveLocationText,
        selectedCategories: effectiveSelectedCategories,
        selectedResourceTypes: effectiveSelectedResourceTypes,
      },
      userEmail,
      {
        prompt_version_id,
        suffix,
      },
    );

    // Handle errors from the streaming response
    if (streamError) {
      setResourcesResultId("");
      setContextDocuments([]);
      return;
    }

    // Set the final parsed resources
    if (resources && resources.length > 0) {
      setResourcesResultId(resultId);
      setContextDocuments(documents);
      onResources(resources);
    } else {
      setResourcesResultId("");
      setContextDocuments([]);
    }
  }

  function handlePrint() {
    // Show print options dialog if there's an action plan (to let user choose)
    // Otherwise, just print the full referrals directly
    if (actionPlan) {
      setShowPrintOptions(true);
    } else {
      setPrintMode("full-referrals");
      window.print();
    }
  }

  function handlePrintModeSelect(mode: PrintMode) {
    setPrintMode(mode);
    setShowPrintOptions(false);
    // Wait for dialog to fully close before printing
    setTimeout(() => {
      window.print();
    }, 300);
  }

  function handleReturnToSearch() {
    abortResources();
    abortActionPlan();
    setShowResultsView(false);
    setRetainedResources(undefined);
    setResourcesResultId("");
    setActionPlanResultId("");
    setExcludedResourceNames([]);
    setContextDocuments([]);
    setLocationText("");
    setSelectedCategories([]);
    setSelectedResourceTypes([]);
    setClientDescription("");
    setSelectedResources([]);
    clearActionPlan();
    setResourcesError(undefined);
    setActionPlanError(undefined);
  }

  function handleResourceSelection(resource: Resource, checked: boolean) {
    if (checked) {
      setSelectedResources((prev) => [...prev, resource]);
    } else {
      setSelectedResources((prev) =>
        prev.filter((r) => r.name !== resource.name),
      );
    }
  }

  function handleSelectAllResources() {
    if (!retainedResources) return;
    if (selectedResources.length === retainedResources.length) {
      setSelectedResources([]);
    } else {
      setSelectedResources(retainedResources);
    }
  }

  function handleRefineSearch(
    newClientDescription: string,
    newLocationText: string,
    newSelectedCategories: string[],
    newSelectedResourceTypes: string[],
  ) {
    // Update state with new values
    setClientDescription(newClientDescription);
    setLocationText(newLocationText);
    setSelectedCategories(newSelectedCategories);
    setSelectedResourceTypes(newSelectedResourceTypes);

    // Clear previous results and action plan
    setRetainedResources(undefined);
    setSelectedResources([]);
    setExcludedResourceNames([]);
    setContextDocuments([]);
    clearActionPlan();
    setActionPlanResultId("");

    // Trigger new search with overrides (since state updates are async)
    void findResources({
      clientDescription: newClientDescription,
      locationText: newLocationText,
      selectedCategories: newSelectedCategories,
      selectedResourceTypes: newSelectedResourceTypes,
    });
  }

  async function generateActionPlan() {
    if (selectedResources.length === 0) return;

    setActionPlanError(undefined);

    const {
      actionPlan: finalPlan,
      resultId,
      errorMessage: planError,
    } = await generateActionPlanFromHook(
      selectedResources,
      userEmail,
      clientDescription,
      contextDocuments,
    );

    // Handle errors from the streaming response
    if (planError) {
      setActionPlanResultId(""); // set the Action Plan Id to "" so we don't email an empty or errant result
      return;
    }

    // Set the final parsed action plan
    if (finalPlan) {
      setActionPlanResultId(resultId);
    } else {
      setActionPlanResultId("");
    }
  }

  // Show nothing while checking localStorage to prevent flash
  if (isCheckingUser) {
    return null;
  }

  // Remove resource handler - wrapper around hook
  const handleRemoveResource = (resourceToRemove: Resource) => {
    handleRemoveFromHook(resourceToRemove, retainedResources);

    // Track the removed resource name for email exclusion (avoid duplicates)
    setExcludedResourceNames((current) =>
      current.includes(resourceToRemove.name)
        ? current
        : [...current, resourceToRemove.name],
    );

    // Immediately remove from retainedResources
    setRetainedResources((current) =>
      current?.filter((r) => r.name !== resourceToRemove.name),
    );

    // Remove from selectedResources as well
    setSelectedResources((current) =>
      current.filter((r) => r.name !== resourceToRemove.name),
    );
  };

  // Undo remove handler - wrapper around hook
  const handleUndoRemove = () => {
    handleUndoFromHook((resource, index) => {
      // Remove from excluded names list
      setExcludedResourceNames((current) =>
        current.filter((name) => name !== resource.name),
      );

      // Add the resource back to retainedResources at its original index
      setRetainedResources((current) => {
        if (!current) {
          return [resource];
        }

        // If we have a stored index, insert at that position
        if (index !== null && index >= 0) {
          const newArray = [...current];
          newArray.splice(index, 0, resource);
          return newArray;
        }

        // Fallback: append to the end
        return [...current, resource];
      });
    });
  };

  return (
    <>
      {!userName || !userEmail ? (
        <WelcomeUserInputScreen
          setUserName={setUserName}
          setUserEmail={setUserEmail}
        />
      ) : (
        <div className="print:hidden overflow-x-hidden">
          <ReferralGeneratorHeader />
          <div className="max-w-5xl mx-auto px-4 flex flex-col gap-2">
            {!showResultsView && (
              <ClientDetailsInput
                selectedCategories={selectedCategories}
                locationText={locationText}
                selectedResourceTypes={selectedResourceTypes}
                clientDescription={clientDescription}
                loading={loading}
                onToggleCategory={toggleCategory}
                onClearAllFilters={clearAllFilters}
                onToggleResourceType={toggleResourceType}
                onLocationChange={setLocationText}
                onClientDescriptionChange={setClientDescription}
                onFindResources={() => void findResources()}
              />
            )}

            {showResultsView && (
              <div className="space-y-4" data-testid="readyToPrintSection">
                <div className="flex items-center justify-between pt-3">
                  <Button
                    onClick={handleReturnToSearch}
                    variant="outline"
                    className="hover:bg-gray-100 hover:text-gray-900"
                    data-testid="returnToSearchButton"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Start a new search
                  </Button>
                  <ShareButtons
                    onPrint={handlePrint}
                    resourcesResultId={resourcesResultId}
                    actionPlanResultId={actionPlanResultId}
                    userEmail={userEmail}
                    excludedResourceNames={excludedResourceNames}
                    disabled={isStreamingActionPlan || isStreamingResources}
                  />
                </div>
              </div>
            )}

            {(isStreamingResources || showResultsView) && (
              <RefinePromptPanel
                clientDescription={clientDescription}
                locationText={locationText}
                selectedCategories={selectedCategories}
                selectedResourceTypes={selectedResourceTypes}
                isLoading={loading}
                isStreamingResources={isStreamingResources}
                onRefine={handleRefineSearch}
              />
            )}

            {(isStreamingResources || showResultsView) && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mt-4">
                  Resources
                </h2>
                <ResourcesList
                  resources={
                    (streamingResources as Resource[]) ??
                    retainedResources ??
                    []
                  }
                  errorMessage={errorMessage}
                  handleRemoveResource={handleRemoveResource}
                  isSearching={
                    isStreamingResources && !hasReceivedFirstResource
                  }
                />
              </>
            )}

            {showResultsView &&
              retainedResources &&
              retainedResources.length > 0 && (
                <ActionPlanSection
                  resources={retainedResources}
                  selectedResources={selectedResources}
                  actionPlan={actionPlan}
                  isGeneratingActionPlan={isGeneratingActionPlan}
                  streamingPlan={streamingPlan}
                  isStreaming={isStreamingActionPlan}
                  onResourceSelection={handleResourceSelection}
                  onSelectAllResources={handleSelectAllResources}
                  onGenerateActionPlan={() => void generateActionPlan()}
                />
              )}

            {showResultsView && (
              <div className="pt-4 border-t mt-6 pb-8">
                <h4 className="text-sm font-medium text-gray-700 mb-3 text-right">
                  Share
                </h4>
                <ShareButtons
                  onPrint={handlePrint}
                  resourcesResultId={resourcesResultId}
                  actionPlanResultId={actionPlanResultId}
                  userEmail={userEmail}
                  excludedResourceNames={excludedResourceNames}
                  className="justify-end"
                  testIdSuffix="bottom"
                  disabled={isStreamingActionPlan || isStreamingResources}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {recentlyRemoved && (
        <RemoveResourceNotification handleUndoRemove={handleUndoRemove} />
      )}

      {/* Print options dialog */}
      <PrintOptionsDialog
        open={showPrintOptions}
        onOpenChange={setShowPrintOptions}
        onSelectMode={handlePrintModeSelect}
        hasActionPlan={!!actionPlan}
      />

      {/* ----- Print-only section ----- */}
      <div className="hidden print:block">
        <PrintableReferralsReport
          resources={retainedResources ?? []}
          clientDescription={clientDescription}
          actionPlan={actionPlan}
          selectedCategories={selectedCategories}
          locationText={locationText}
          selectedResourceTypes={selectedResourceTypes}
          printMode={printMode}
          selectedResources={selectedResources}
        />
      </div>
    </>
  );
}
