import {
  Building,
  Layers,
  type LucideIcon,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { HOST_ORG_NAME } from "@/config/hostOrg";

export const resourceCategories = [
  { id: "childcare", label: "Childcare", emoji: "👶" },
  { id: "disability", label: "Disability Services", emoji: "♿" },
  { id: "education", label: "Education & GED", emoji: "🎓" },
  { id: "employment", label: "Employment & Job Training", emoji: "💼" },
  { id: "financial", label: "Financial Assistance", emoji: "💵" },
  { id: "food", label: "Food Assistance", emoji: "🍽️" },
  { id: "healthcare", label: "Healthcare & Mental Health", emoji: "🩺" },
  { id: "housing", label: "Housing & Shelter", emoji: "🏠" },
  { id: "legal", label: "Legal Services", emoji: "⚖️" },
  { id: "substance", label: "Substance Use & Treatment", emoji: "🛡️" },
  { id: "transportation", label: "Transportation", emoji: "🚗" },
  { id: "veterans", label: "Veterans Services", emoji: "🎖️" },
];

// Provider types for the Resource Provider Selection section
export const providerTypes: {
  id: string;
  label: string;
  emoji?: string;
  icon?: LucideIcon;
}[] = [
  { id: "internal", label: HOST_ORG_NAME, icon: Building },
  { id: "government", label: "Government", emoji: "🏛️" },
  { id: "community", label: "Community", emoji: "👥" },
];

interface ClientDetailsInputProps {
  selectedCategories: string[];
  locationText: string;
  selectedResourceTypes: string[];
  clientDescription: string;
  loading: boolean;
  onToggleCategory: (categoryId: string) => void;
  onClearAllFilters: () => void;
  onToggleResourceType: (type: string) => void;
  onLocationChange: (location: string) => void;
  onClientDescriptionChange: (description: string) => void;
  onFindResources: () => void;
}

export function ClientDetailsInput({
  selectedCategories,
  locationText,
  selectedResourceTypes,
  clientDescription,
  loading,
  onToggleCategory,
  onClearAllFilters,
  onToggleResourceType,
  onLocationChange,
  onClientDescriptionChange,
  onFindResources,
}: ClientDetailsInputProps) {
  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          Let&apos;s Find the Right Resources for Your Clients
        </h1>
        <p className="text-gray-600 max-w-xl">
          Share some details about your client&apos;s situation, and we&apos;ll
          help you discover the perfect resources and referrals tailored to
          their specific needs.
        </p>
      </div>

      {/* Tell us about your client */}
      <Card
        className="bg-gray-50 border-gray-200"
        data-testid="clientDescriptionInputSection"
      >
        <CardContent className="p-4">
          <h2 className="font-medium text-gray-900 mb-1 flex items-center gap-2 text-base">
            <UserRound className="w-4 h-4 text-blue-600" aria-hidden="true" />
            What kind of resources is your client looking for?
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Include details about your client&apos;s circumstances to help find
            better resources
          </p>
          <Textarea
            placeholder="Example: My client is looking for medical assistant training, diapers and clothes for job interviews."
            id="clientDescriptionInput"
            value={clientDescription}
            onChange={(e) => onClientDescriptionChange(e.target.value)}
            className="min-h-[8rem] min-w-[16rem] text-base bg-white mt-2"
            data-testid="clientDescriptionInput"
            disabled={loading}
          />
        </CardContent>
      </Card>

      {/* Location */}
      <Card
        className="bg-gray-50 border-gray-200"
        data-testid="locationFilterSection"
      >
        <CardContent className="p-4">
          <h2 className="font-medium text-gray-900 mb-1 flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4 text-blue-600" aria-hidden="true" />
            Location
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Optional - helps find resources near your client
          </p>
          <Input
            placeholder="Enter zip code, city name, or neighborhood..."
            value={locationText}
            onChange={(e) => onLocationChange(e.target.value)}
            className="border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500"
            data-testid="locationFilterInput"
            disabled={loading}
            aria-label="Location"
          />
        </CardContent>
      </Card>

      {/* Resource Categories */}
      <Card
        className="bg-gray-50 border-gray-200"
        data-testid="referralFiltersSection"
      >
        <CardContent className="p-4">
          <h2 className="font-medium text-gray-900 mb-1 flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-blue-600" aria-hidden="true" />
            Resource Categories
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Optional - select categories to narrow your search
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {resourceCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <Button
                  key={category.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={`text-sm flex-col justify-center px-1 min-h-28 w-auto whitespace-normal break-words h-auto cursor-pointer disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  onClick={() => onToggleCategory(category.id)}
                  data-testid={"resourceCategoryToggle-" + category.id}
                  aria-pressed={isSelected}
                  disabled={loading}
                >
                  <span
                    className={`text-2xl flex items-center justify-center w-10 h-10 ${isSelected ? "bg-white/90 rounded-full" : ""}`}
                    aria-hidden="true"
                  >
                    {category.emoji}
                  </span>
                  {category.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resource Provider Selection */}
      <Card
        className="bg-gray-50 border-gray-200"
        data-testid="resourceProviderSection"
      >
        <CardContent className="p-4">
          <h2 className="font-medium text-gray-900 mb-1 flex items-center gap-2 text-base">
            <Search className="w-4 h-4 text-blue-600" aria-hidden="true" />
            Resource Provider Selection
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Select up to 3 provider types, or leave empty to search all
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {providerTypes.map((provider) => {
              const isSelected = selectedResourceTypes.includes(provider.id);
              return (
                <Button
                  key={provider.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={`h-12 text-sm cursor-pointer disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  onClick={() => onToggleResourceType(provider.id)}
                  data-testid={`resourceCategoryToggle-${provider.id}`}
                  aria-pressed={isSelected}
                  disabled={loading}
                >
                  {provider.icon ? (
                    <provider.icon
                      className="w-5 h-5 mr-2"
                      aria-hidden="true"
                    />
                  ) : (
                    provider.emoji && (
                      <span
                        className={`text-xl flex items-center justify-center w-8 h-8 mr-1 ${isSelected ? "bg-white/90 rounded-full" : ""}`}
                        aria-hidden="true"
                      >
                        {provider.emoji}
                      </span>
                    )
                  )}
                  {provider.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Clear All Button - outside cards since it clears all filters */}
      {(selectedCategories.length > 0 ||
        selectedResourceTypes.length > 0 ||
        locationText) && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAllFilters}
            className="text-gray-600 border-gray-300 hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400 cursor-pointer disabled:cursor-not-allowed"
            data-testid="clearFiltersButton"
            disabled={loading}
          >
            <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Spacer to account for fixed button at bottom */}
      <div className="h-24" />

      {/* Fixed floating button at bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button
            type="button"
            onClick={onFindResources}
            disabled={
              loading ||
              (selectedCategories.length === 0 && !clientDescription.trim())
            }
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-500 disabled:text-white text-lg pt-6 pb-6 cursor-pointer disabled:cursor-not-allowed"
            data-testid="findResourcesButton"
          >
            {!loading && (
              <>
                <Sparkles className="w-5 h-5" aria-hidden="true" />
                Find Referrals
              </>
            )}
            {loading && (
              <>
                <Spinner className="w-5 h-5" />
                Finding Resources...
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
