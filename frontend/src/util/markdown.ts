import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export interface Citation {
  domain: string;
  url: string;
}

/**
 * Extracts citation links from markdown content and removes them from the body.
 * Citations are parenthetical domain references like ([domain.org](url))
 * Returns the modified content (citations removed) and a list of unique citations for the sources section.
 */
export function extractCitations(content: string): {
  content: string;
  citations: Citation[];
} {
  const citations: Citation[] = [];
  const seenDomains = new Set<string>();

  // Pattern matches: ([domain](url)) - markdown link in parentheses
  // The domain text is just the domain name, URL is the full link
  const pattern = /\s*\(\[([a-z0-9.-]+\.[a-z]{2,6})\]\(([^)]+)\)\)/gi;

  const modifiedContent = content.replace(
    pattern,
    (_match: string, domain: string, url: string) => {
      // Collect unique citations
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        citations.push({ domain, url });
      }
      // Remove the citation from the body text
      return "";
    },
  );

  return { content: modifiedContent, citations };
}

/**
 * Converts markdown content to HTML using remark + rehype
 * Supports GitHub Flavored Markdown (GFM) including lists, links, bold, italic, etc.
 * @param content - The markdown content to parse
 * @param options - Optional configuration
 * @param options.isStreaming - When true, applies styling to horizontal rules (used during streaming)
 */
export function parseMarkdownToHTML(
  content: string,
  options?: { isStreaming?: boolean },
): string {
  if (!content) return "";

  // Strip OpenAI web search citation markers like 【turn0search0】 that sometimes leak through
  content = content.replace(/【[^】]*】/g, "");

  const file = unified()
    .use(remarkParse) // Parse markdown to AST
    .use(remarkGfm) // Support GitHub Flavored Markdown (tables, strikethrough, task lists, etc.)
    .use(remarkRehype) // Convert markdown AST to HTML AST
    .use(rehypeSanitize) // Sanitize HTML to prevent XSS attacks
    .use(rehypeStringify) // Convert HTML AST to string
    .processSync(content);

  let html = String(file);

  // Apply Tailwind CSS classes to the generated HTML elements
  html = html.replace(
    /<h1>/g,
    '<h1 class="text-2xl font-bold mb-4 text-gray-900">',
  );
  html = html.replace(
    /<h2>/g,
    '<h2 class="text-xl font-semibold mb-3 text-gray-800">',
  );
  html = html.replace(
    /<h3>/g,
    '<h3 class="text-lg font-semibold mb-2 text-gray-800">',
  );
  html = html.replace(
    /<h4>/g,
    '<h4 class="text-base font-semibold mb-2 text-gray-800">',
  );
  html = html.replace(
    /<h5>/g,
    '<h5 class="text-sm font-semibold mb-2 text-gray-800">',
  );
  html = html.replace(
    /<h6>/g,
    '<h6 class="text-xs font-semibold mb-2 text-gray-800">',
  );

  html = html.replace(/<p>/g, '<p class="mb-3 leading-relaxed">');

  html = html.replace(
    /<strong>/g,
    '<strong class="font-semibold text-gray-900">',
  );
  html = html.replace(/<em>/g, '<em class="italic">');

  // External links: add target blank, styling, and screen reader text for new tab
  html = html.replace(
    /<a href="([^"]+)">([^<]+)<\/a>/g,
    '<a target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline" href="$1">$2<span class="sr-only"> (opens in new tab)</span></a>',
  );

  html = html.replace(/<ul>/g, '<ul class="list-disc ml-6 mb-4 space-y-1">');
  html = html.replace(/<ol>/g, '<ol class="list-decimal ml-6 mb-4 space-y-1">');
  html = html.replace(/<li>/g, '<li class="mb-1 leading-relaxed">');

  html = html.replace(
    /<blockquote>/g,
    '<blockquote class="border-l-4 border-gray-300 pl-4 italic my-4">',
  );
  html = html.replace(
    /<code>/g,
    '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">',
  );
  html = html.replace(
    /<pre>/g,
    '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4">',
  );

  // Style horizontal rules only during streaming (used as section dividers)
  if (options?.isStreaming) {
    html = html.replace(/<hr>/g, '<hr class="my-8 border-t border-gray-300">');
  }

  return html;
}
