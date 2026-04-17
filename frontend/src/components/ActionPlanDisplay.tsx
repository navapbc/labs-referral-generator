import { ActionPlan, PartialActionPlan } from "@/util/fetchActionPlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import {
  parseMarkdownToHTML,
  extractCitations,
  Citation,
} from "@/util/markdown";
import { Resource } from "@/types/resources";
import { getCardBorderClass } from "@/components/ResourcesList";

interface ActionPlanDisplayProps {
  actionPlan: ActionPlan | null;
  streamingPlan?: PartialActionPlan | null;
  isStreaming?: boolean;
  selectedResources?: Resource[];
}

interface SplitResult {
  intro: string | null;
  sections: string[];
}

/**
 * Split content into intro + resource sections.
 *
 * Strategy:
 * 1. Try splitting on `## ` (h2) headings first
 * 2. If no h2 headings found, fall back to `### ` (h3) for backward compatibility
 * 3. Any content before the first heading becomes the "intro"
 * 4. Preserve original order; no reordering
 */
function splitIntoSections(content: string): SplitResult {
  const hasH2 = /^## /m.test(content);
  const hasH3 = /^### /m.test(content);

  if (!hasH2 && !hasH3) {
    return { intro: null, sections: [content] };
  }

  const headingLevel = hasH2 ? 2 : 3;
  const headingPattern = headingLevel === 2 ? /^## /m : /^### /m;
  const splitPattern = headingLevel === 2 ? /(?=^## )/m : /(?=^### )/m;

  const parts = content.split(splitPattern).filter((s) => s.trim());

  let intro: string | null = null;
  let sections: string[] = parts;

  if (parts.length > 0 && !headingPattern.test(parts[0])) {
    intro = parts[0];
    sections = parts.slice(1);
  }

  return { intro, sections };
}

/**
 * Find a resource by exact heading match (case-insensitive).
 * Only matches if heading text exactly equals resource.name.
 */
function findResourceByExactHeading(
  section: string,
  resources: Resource[],
): Resource | undefined {
  const match = section.match(/^#{2,3}\s+(.+?)(?:\n|$)/);
  if (!match) return undefined;

  const headingText = match[1].trim();

  return resources.find(
    (r) => r.name.toLowerCase() === headingText.toLowerCase(),
  );
}

// Validate URL uses safe protocol (http/https only)
function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// Sources section component
function SourcesSection({ citations }: { citations: Citation[] }) {
  // Filter to only citations with safe URLs
  const safeCitations = citations.filter((c) => isSafeUrl(c.url));
  if (safeCitations.length === 0) return null;

  return (
    <nav aria-label="Sources" className="mt-6 pt-4 border-t border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Sources</h3>
      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
        {safeCitations.map((citation, index) => (
          <li key={index}>
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {citation.domain}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ActionPlanDisplay({
  actionPlan,
  streamingPlan,
  isStreaming,
  selectedResources = [],
}: ActionPlanDisplayProps) {
  // If streaming, show partial content with progressive rendering
  if (isStreaming && streamingPlan) {
    const displayTitle = streamingPlan.title || "Generating Action Plan...";

    return (
      <Card className="bg-gray-100 border-gray-200 shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
            {displayTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Show summary if available */}
          {streamingPlan.summary && (
            <div className="mb-4 text-gray-800 text-base">
              {streamingPlan.summary}
            </div>
          )}

          {/* Show content with markdown rendering and blinking cursor */}
          {streamingPlan.content && (
            <div className="relative bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{
                  __html: parseMarkdownToHTML(streamingPlan.content, {
                    isStreaming: true,
                  }),
                }}
              />
              {/* Blinking cursor to indicate streaming */}
              <span
                className="inline-block w-2 h-4 bg-blue-600 animate-pulse motion-reduce:animate-none ml-1 align-middle"
                aria-hidden="true"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Otherwise show parsed action plan (final complete version)
  if (!actionPlan) return null;

  // Extract citations from content for the sources section
  const { content: contentWithRefs, citations } = extractCitations(
    actionPlan.content,
  );
  const { intro, sections } = splitIntoSections(contentWithRefs);

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900">
          {actionPlan.title}
        </h2>
      </div>

      {/* Summary */}
      <div className="mb-6 text-gray-800 text-base">{actionPlan.summary}</div>

      {/* Intro block (content before first heading) */}
      {intro && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <div
            className="prose prose-sm max-w-none text-gray-800"
            dangerouslySetInnerHTML={{
              __html: parseMarkdownToHTML(intro),
            }}
          />
        </div>
      )}

      {/* Render each resource section as its own card */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const matchedResource = findResourceByExactHeading(
            section,
            selectedResources,
          );
          const borderClass = matchedResource
            ? getCardBorderClass(matchedResource.referral_type)
            : "";

          return (
            <div
              key={index}
              className={`bg-white border border-gray-200 rounded-lg p-5 ${borderClass}`}
            >
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{
                  __html: parseMarkdownToHTML(section),
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Sources section at bottom */}
      <SourcesSection citations={citations} />
    </div>
  );
}
