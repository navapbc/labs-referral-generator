import { Resource } from "@/types/resources";
import { extractField, extractArrayField } from "./parseStreamingUtils";

/**
 * Partial resource type for streaming - all fields are optional
 * but we only render resources that have at least a name
 */
export type PartialResource = Partial<Resource>;

/**
 * Parses streaming JSON to extract an array of partial resources
 * Handles incomplete JSON gracefully - captures partial objects and fields
 * Builds resources incrementally as data streams in
 */
export function parseStreamingResources(jsonStr: string): PartialResource[] {
  const resources: PartialResource[] = [];

  try {
    // Find the start of the resources array
    const resourcesKeyMatch = jsonStr.match(/"resources"\s*:\s*\[/);

    if (!resourcesKeyMatch) {
      return resources;
    }

    // Find the position right after the opening bracket
    const arrayStartPos =
      resourcesKeyMatch.index! + resourcesKeyMatch[0].length;

    /**
     * BRACKET DEPTH TRACKING ALGORITHM
     *
     * This section finds the matching closing bracket for the "resources" array
     * by maintaining a depth counter. This is necessary because:
     * 1. The array may contain nested arrays (e.g., addresses, phones)
     * 2. We need to handle incomplete streaming JSON (no closing bracket yet)
     * 3. We must ignore brackets inside string values
     *
     * Algorithm:
     * - bracketDepth starts at 1 (we're already inside the resources array)
     * - For each '[', increment depth (entering nested array)
     * - For each ']', decrement depth (exiting nested array)
     * - When depth reaches 0, we've found the matching closing bracket
     * - If we reach end of string with depth > 0, the array is incomplete (streaming)
     *
     * String state tracking (inString flag):
     * - Prevents counting brackets that appear inside string values
     * - Example: "address": "123 Main St [Apt 4]" should not affect depth
     * - Toggles on/off when encountering unescaped quotes (not preceded by \)
     */
    let bracketDepth = 1; // We're already inside the resources array
    let inString = false;
    let prevChar = "";
    let arrayEndPos = jsonStr.length; // Default to end of string for incomplete streams

    for (let i = arrayStartPos; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      // Track string state to ignore brackets inside strings
      if (char === '"' && prevChar !== "\\") {
        inString = !inString;
      }

      if (!inString) {
        if (char === "[") {
          bracketDepth++;
        } else if (char === "]") {
          bracketDepth--;
          if (bracketDepth === 0) {
            // Found the matching closing bracket for the resources array
            arrayEndPos = i;
            break;
          }
        }
      }

      prevChar = char;
    }

    // Extract the array content (everything between the opening bracket and either
    // the closing bracket or the end of the string for incomplete streams)
    const arrayContent = jsonStr.substring(arrayStartPos, arrayEndPos);

    /**
     * RESOURCE OBJECT BOUNDARY DETECTION
     *
     * This section identifies individual resource objects within the array by
     * tracking brace depth. Similar to bracket tracking above, but for objects.
     *
     * We want to identify each top-level `{...}` in the array:
     * Example: [{"name": "A"}, {"name": "B", "addresses": ["X", "Y"]}, {"name"
     *           ^-- resource 1 --^ ^-- resource 2 (has nested array) ----^ ^-- incomplete
     *
     * Algorithm:
     * - braceDepth = 0 means we're between objects
     * - When braceDepth goes from 0→1, we mark the start of a new resource
     * - When braceDepth goes from 1→0, we mark the end of that resource
     * - Nested objects (e.g., in a field value) don't trigger new resources
     *   because we only care about 0→1 transitions
     *
     * Handling incomplete resources:
     * - If we reach end of array content with braceDepth > 0, the last resource
     *   is incomplete (still streaming from server)
     * - We include it anyway so users see partial data during streaming
     * - parsePartialResource handles incomplete JSON gracefully
     */
    const resourceRanges: Array<{ start: number; end: number }> = [];
    let braceDepth = 0;
    inString = false; // Reset the string tracking flag
    prevChar = ""; // Reset the previous char tracker
    let resourceStart = -1;

    for (let i = 0; i < arrayContent.length; i++) {
      const char = arrayContent[i];

      // Track string state to ignore braces inside strings
      if (char === '"' && prevChar !== "\\") {
        inString = !inString;
      }

      if (!inString) {
        if (char === "{") {
          if (braceDepth === 0) {
            // Start of a new resource object
            resourceStart = i;
          }
          braceDepth++;
        } else if (char === "}") {
          braceDepth--;
          if (braceDepth === 0 && resourceStart !== -1) {
            // End of a resource object
            resourceRanges.push({ start: resourceStart, end: i + 1 });
            resourceStart = -1;
          }
        }
      }

      prevChar = char;
    }

    // If we have an incomplete resource (braceDepth > 0), include it
    if (resourceStart !== -1 && braceDepth > 0) {
      resourceRanges.push({ start: resourceStart, end: arrayContent.length });
    }

    // Parse each resource object (including incomplete ones)
    for (let i = 0; i < resourceRanges.length; i++) {
      const range = resourceRanges[i];
      const resourceStr = arrayContent.substring(range.start, range.end);
      const resource = parsePartialResource(resourceStr);

      // Only include resources that have a name (per user requirement)
      if (resource.name) {
        resources.push(resource);
      }
    }
  } catch (e) {
    console.error("Error parsing streaming resources:", e);
  }

  return resources;
}

/**
 * Parses a single partial resource object from JSON string
 */
function parsePartialResource(resourceStr: string): PartialResource {
  const resource: PartialResource = {};

  // Extract simple string fields
  const name = extractField(resourceStr, "name");
  if (name) resource.name = name;

  const description = extractField(resourceStr, "description");
  if (description) resource.description = description;

  const website = extractField(resourceStr, "website");
  if (website) resource.website = website;

  const referral_type = extractField(resourceStr, "referral_type");
  if (
    referral_type &&
    ["external", "internal", "government"].includes(referral_type)
  ) {
    resource.referral_type = referral_type as
      | "external"
      | "internal"
      | "government";
  }

  const justification = extractField(resourceStr, "justification");
  if (justification) resource.justification = justification;

  // Extract array fields
  const addresses = extractArrayField(resourceStr, "addresses");
  if (addresses.length > 0) {
    resource.addresses = addresses;
  }

  const phones = extractArrayField(resourceStr, "phones");
  if (phones.length > 0) {
    resource.phones = phones;
  }

  const emails = extractArrayField(resourceStr, "emails");
  if (emails.length > 0) {
    resource.emails = emails;
  }

  return resource;
}
