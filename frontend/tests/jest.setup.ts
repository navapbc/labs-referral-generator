import "@testing-library/jest-dom";

import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// Mock the markdown parser to avoid ES module issues with unified/remark/rehype
jest.mock("../src/util/markdown", () => ({
  parseMarkdownToHTML: (content: string) => content,
  extractCitations: (content: string) => ({ content, citations: [] }),
}));
