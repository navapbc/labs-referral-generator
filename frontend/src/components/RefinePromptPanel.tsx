import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { resourceCategories, providerTypes } from "./ClientDetailsInput";

// Shared button styles for toggle buttons (categories, providers)
const TOGGLE_BUTTON_STYLES = {
  selected: "bg-blue-600 text-white hover:bg-blue-700",
  unselected: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
} as const;

interface RefinePromptPanelProps {
  clientDescription: string;
  locationText: string;
  selectedCategories: string[];
  selectedResourceTypes: string[];
  isLoading: boolean;
  isStreamingResources?: boolean;
  onRefine: (
    newClientDescription: string,
    newLocationText: string,
    newSelectedCategories: string[],
    newSelectedResourceTypes: string[],
  ) => void;
}

export function RefinePromptPanel({
  clientDescription,
  locationText,
  selectedCategories,
  selectedResourceTypes,
  isLoading,
  isStreamingResources = false,
  onRefine,
}: RefinePromptPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Local form state
  const [localClientDescription, setLocalClientDescription] =
    useState(clientDescription);
  const [localLocationText, setLocalLocationText] = useState(locationText);
  const [localSelectedCategories, setLocalSelectedCategories] =
    useState<string[]>(selectedCategories);
  const [localSelectedResourceTypes, setLocalSelectedResourceTypes] = useState<
    string[]
  >(selectedResourceTypes);

  // Sync local state when props change (e.g., after a new search completes)
  useEffect(() => {
    setLocalClientDescription(clientDescription);
    setLocalLocationText(locationText);
    setLocalSelectedCategories(selectedCategories);
    setLocalSelectedResourceTypes(selectedResourceTypes);
  }, [
    clientDescription,
    locationText,
    selectedCategories,
    selectedResourceTypes,
  ]);

  // Get category labels from IDs for display
  const categoryLabels = selectedCategories
    .map((id) => resourceCategories.find((c) => c.id === id)?.label)
    .filter(Boolean);

  // Get provider type labels from IDs for display
  const providerLabels = selectedResourceTypes
    .map((id) => providerTypes.find((p) => p.id === id)?.label)
    .filter(Boolean);

  // Build metadata string
  const metadataParts: string[] = [];
  if (categoryLabels.length > 0) {
    metadataParts.push(`Categories: ${categoryLabels.join(", ")}`);
  }
  if (locationText) {
    metadataParts.push(`Location: ${locationText}`);
  }
  if (providerLabels.length > 0) {
    metadataParts.push(`Providers: ${providerLabels.join(", ")}`);
  }

  const handleToggleCategory = (categoryId: string) => {
    setLocalSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  const handleToggleResourceType = (type: string) => {
    setLocalSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleCancel = () => {
    // Reset to original values
    setLocalClientDescription(clientDescription);
    setLocalLocationText(locationText);
    setLocalSelectedCategories(selectedCategories);
    setLocalSelectedResourceTypes(selectedResourceTypes);
    setIsExpanded(false);
  };

  const handleUpdateSearch = () => {
    onRefine(
      localClientDescription,
      localLocationText,
      localSelectedCategories,
      localSelectedResourceTypes,
    );
    setIsExpanded(false);
  };

  // Auto-collapse when loading starts
  useEffect(() => {
    if (isLoading) {
      setIsExpanded(false);
    }
  }, [isLoading]);

  // Derived state for cleaner conditionals
  const isDisabled = isLoading || isStreamingResources;

  // Toggle button label based on current state
  const getToggleButtonLabel = () => {
    if (isStreamingResources) return "Edit search (loading resources...)";
    if (isLoading) return "Updating search...";
    if (isExpanded) return "Editing search";
    return "Edit search";
  };

  return (
    <div data-testid="refinePromptPanel">
      <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-4">
        Your Search
      </h2>
      <div
        className={`rounded-2xl border overflow-hidden ${isExpanded ? "border-blue-300" : "border-gray-200"}`}
      >
        {/* Search Summary */}
        <div className="bg-gray-100 p-4">
          <p
            className="text-lg font-semibold text-gray-900 text-center"
            data-testid="searchQueryDisplay"
          >
            {clientDescription}
          </p>
          {metadataParts.length > 0 && (
            <p
              className="text-sm text-gray-600 text-center mt-2"
              data-testid="searchMetadataDisplay"
            >
              {metadataParts.join(" | ")}
            </p>
          )}
        </div>

        {/* Edit Search Toggle */}
        <button
          onClick={() => !isDisabled && setIsExpanded(!isExpanded)}
          disabled={isDisabled}
          className={`w-full flex items-center justify-center p-4 text-left transition-colors border-t ${
            isExpanded
              ? "bg-blue-50 border-blue-200"
              : "bg-white hover:bg-gray-50 border-gray-200"
          } ${isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          aria-expanded={isExpanded}
          aria-controls="refine-search-form"
          data-testid="refinePromptPanelToggle"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">
              ✏️
            </span>
            <span
              className={`font-medium ${isDisabled ? "text-gray-500" : "text-blue-700"}`}
            >
              {getToggleButtonLabel()}
            </span>
            {isDisabled && (
              <Spinner className="w-4 h-4 text-gray-500" aria-label="Loading" />
            )}
            {!isDisabled &&
              (isExpanded ? (
                <ChevronUp
                  className="w-5 h-5 text-blue-600"
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="w-5 h-5 text-gray-500"
                  aria-hidden="true"
                />
              ))}
          </div>
        </button>

        {/* Expandable Form */}
        {isExpanded && (
          <div
            id="refine-search-form"
            className="p-4 bg-white border-t border-blue-200 space-y-4"
          >
            {/* Client Description */}
            <div>
              <label
                htmlFor="refineClientDescription"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                What kind of resources is your client looking for?
              </label>
              <p className="text-xs text-gray-600 mb-2">
                Include details about your client&apos;s circumstances
              </p>
              <Textarea
                id="refineClientDescription"
                value={localClientDescription}
                onChange={(e) => setLocalClientDescription(e.target.value)}
                placeholder="Describe your client's needs..."
                className="min-h-[6rem] text-base"
                data-testid="refineClientDescriptionInput"
              />
            </div>

            {/* Location */}
            <div>
              <label
                htmlFor="refineLocation"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Location (optional)
              </label>
              <Input
                id="refineLocation"
                value={localLocationText}
                onChange={(e) => setLocalLocationText(e.target.value)}
                placeholder="Zip code, city, or neighborhood..."
                data-testid="refineLocationInput"
              />
            </div>

            {/* Resource Categories */}
            <div role="group" aria-labelledby="refine-categories-label">
              <span
                id="refine-categories-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Resource categories (optional)
              </span>
              <div className="flex flex-wrap gap-2">
                {resourceCategories.map((category) => {
                  const isSelected = localSelectedCategories.includes(
                    category.id,
                  );
                  return (
                    <Button
                      key={category.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`text-sm cursor-pointer ${
                        isSelected
                          ? TOGGLE_BUTTON_STYLES.selected
                          : TOGGLE_BUTTON_STYLES.unselected
                      }`}
                      onClick={() => handleToggleCategory(category.id)}
                      data-testid={`refine-category-${category.id}`}
                      aria-pressed={isSelected}
                    >
                      <span aria-hidden="true">{category.emoji}</span>
                      {category.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Provider Types */}
            <div role="group" aria-labelledby="refine-providers-label">
              <span
                id="refine-providers-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Provider types (optional)
              </span>
              <div className="flex flex-wrap gap-2">
                {providerTypes.map((provider) => {
                  const isSelected = localSelectedResourceTypes.includes(
                    provider.id,
                  );
                  return (
                    <Button
                      key={provider.id}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`text-sm cursor-pointer ${
                        isSelected
                          ? TOGGLE_BUTTON_STYLES.selected
                          : TOGGLE_BUTTON_STYLES.unselected
                      }`}
                      onClick={() => handleToggleResourceType(provider.id)}
                      data-testid={`refine-provider-${provider.id}`}
                      aria-pressed={isSelected}
                    >
                      {provider.icon ? (
                        <provider.icon className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        provider.emoji && (
                          <span aria-hidden="true">{provider.emoji}</span>
                        )
                      )}
                      {provider.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleUpdateSearch}
                disabled={
                  !localClientDescription.trim() &&
                  localSelectedCategories.length === 0
                }
                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:cursor-not-allowed"
                data-testid="updateSearchButton"
              >
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                Search Again
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="cursor-pointer hover:bg-gray-100 hover:text-gray-900"
                data-testid="cancelEditButton"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
