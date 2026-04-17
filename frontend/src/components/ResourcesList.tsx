import { Resource } from "@/types/resources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import React from "react";
import { Building, Users, X } from "lucide-react";

const isValidURL = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const referralTypeIndicator = (referralType: string | undefined) => {
  switch (referralType) {
    case "internal": {
      return (
        <span
          data-testid="internal_referral"
          className="inline-flex items-center gap-1.5 bg-transparent text-blue-800 ml-4 mt-3 px-2.5 py-1 max-w-[15rem] text-sm font-bold"
        >
          <Building className="h-4 w-4 shrink-0" />
          <span className="truncate">Internal</span>
        </span>
      );
    }
    case "government": {
      return (
        <span
          data-testid="government_referral"
          className="inline-flex items-center gap-1.5 bg-transparent text-gray-800 ml-4 mt-3 px-2.5 py-1 max-w-[15rem] text-sm font-bold"
        >
          <Building className="h-4 w-4 shrink-0" />
          <span className="truncate">Government</span>
        </span>
      );
    }
    case "external": {
      return (
        <span
          data-testid="external_referral"
          className="inline-flex items-center gap-1.5 bg-transparent text-green-800 ml-4 mt-3 px-2.5 py-1 max-w-[15rem] text-sm font-bold"
        >
          <Users className="h-4 w-4 shrink-0" />
          <span className="truncate">Community</span>
        </span>
      );
    }
    default: {
      // Loading placeholder - maintains spacing while streaming
      return (
        <span
          data-testid="loading_referral"
          className="inline-flex items-center gap-1.5 bg-transparent text-gray-400 ml-4 mt-3 px-2.5 py-1 max-w-[15rem] text-sm font-bold"
        >
          <span className="h-4 w-4 shrink-0 bg-gray-200 rounded animate-pulse" />
          <span className="truncate bg-gray-200 rounded animate-pulse w-16 h-4" />
        </span>
      );
    }
  }
};

export const getCardBorderClass = (referralType: string | undefined) => {
  switch (referralType) {
    case "internal":
      return "border-t-4 border-t-blue-600 rounded-t-lg";
    case "government":
      return "border-t-4 border-t-gray-600 rounded-t-lg";
    case "external":
      return "border-t-4 border-t-green-600 rounded-t-lg";
    default:
      // Loading state - gray border maintains spacing while streaming
      return "border-t-4 border-t-gray-300 rounded-t-lg";
  }
};

const getNumberBadgeClass = (referralType: string | undefined) => {
  switch (referralType) {
    case "internal":
      return "bg-blue-600";
    case "government":
      return "bg-gray-600";
    case "external":
      return "bg-green-600";
    default:
      return "bg-blue-600";
  }
};

const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (/^(https?:)?\/\//i.test(trimmed) || /^(mailto:|tel:)/i.test(trimmed)) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  return `https://${trimmed}`;
};

type ResourcesListProps = {
  resources: Resource[];
  errorMessage?: string;
  handleRemoveResource: (resource: Resource) => void;
  isSearching?: boolean;
};

// NOTE: If you change the card layout below, update this placeholder to match
const PlaceholderCard = ({ index }: { index: number }) => (
  <Card
    className="relative bg-white shadow-sm mb-5 min-w-[16rem] border-t-4 border-t-gray-300 rounded-t-lg"
    data-testid={`resource-card-placeholder-${index}`}
    aria-hidden="true"
  >
    {/* Placeholder referral type indicator */}
    <span className="inline-flex items-center gap-1.5 bg-transparent ml-4 mt-3 px-2.5 py-1 max-w-[15rem]">
      <span className="h-4 w-4 shrink-0 bg-gray-200 rounded animate-pulse" />
      <span className="bg-gray-200 rounded animate-pulse w-16 h-4" />
    </span>
    <CardHeader className="p-3 ml-3">
      <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <span className="flex-shrink-0 w-7 h-7 bg-gray-300 text-white rounded-full flex items-center justify-center text-m font-medium animate-pulse">
          {index + 1}
        </span>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-48" />
      </CardTitle>
    </CardHeader>
    <CardContent className="ml-9 mr-4 space-y-2">
      <div className="h-4 bg-gray-200 rounded animate-pulse w-64" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-40" />
      <div className="h-4 bg-gray-200 rounded animate-pulse w-56" />
      <div className="mt-3 space-y-1">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
      </div>
    </CardContent>
  </Card>
);

const ResourcesList = ({
  resources,
  errorMessage,
  handleRemoveResource,
  isSearching = false,
}: ResourcesListProps) => {
  if (resources.length === 0) {
    if (isSearching) {
      return (
        <div className="mt-2" role="status" aria-label="Loading resources">
          <span className="sr-only">Loading resources, please wait...</span>
          <PlaceholderCard index={0} />
          <PlaceholderCard index={1} />
          <PlaceholderCard index={2} />
        </div>
      );
    }
    return <div className="m-3">{errorMessage || "No resources found."}</div>;
  }

  return (
    <div className="mt-2">
      {resources.map((r, i) => (
        <Card
          key={i}
          className={`relative bg-white shadow-sm mb-5 min-w-[16rem] ${getCardBorderClass(r.referral_type)}`}
          data-testid={`resource-card${r.referral_type ? `-${r.referral_type}` : ""}-${i}`}
        >
          {referralTypeIndicator(r.referral_type)}
          {/* Remove button */}
          <button
            onClick={() => handleRemoveResource(r)}
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-xs font-medium border border-red-200 cursor-pointer print:hidden"
            title="Remove resource"
            data-testid={`remove-resource-button-${i}`}
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Remove</span>
          </button>
          <CardHeader className="p-3 ml-3">
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span
                className={`flex-shrink-0 w-7 h-7 ${getNumberBadgeClass(r.referral_type)} text-white rounded-full flex items-center justify-center text-m font-medium`}
              >
                {i + 1}
              </span>
              <div>{r.name}</div>
            </CardTitle>
          </CardHeader>
          <CardContent className="ml-9 mr-4">
            {r.addresses && r.addresses?.length > 0 && (
              <div className="mt-1">
                <span className="font-semibold">Address:</span>{" "}
                {r.addresses.join(" | ")}
              </div>
            )}
            {r.phones && r.phones?.length > 0 && (
              <div className="mt-1">
                <span className="font-semibold">Phone:</span>{" "}
                {r.phones.join(" | ")}
              </div>
            )}
            {r.emails && r.emails?.length > 0 && (
              <div className="mt-1">
                <span className="font-semibold">Email:</span>{" "}
                {r.emails.join(" | ")}
              </div>
            )}
            {!!r.website && isValidURL(normalizeUrl(r.website)) && (
              <div className="mt-1">
                <span className="font-semibold">Website:</span>{" "}
                <Link
                  href={normalizeUrl(r.website)}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-blue-600 hover:underline break-all"
                  prefetch={false}
                  data-testid={`website-link-${i}`}
                >
                  {r.website}
                </Link>
              </div>
            )}
            {r.description && <div className="mt-3">{r.description}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ResourcesList;
