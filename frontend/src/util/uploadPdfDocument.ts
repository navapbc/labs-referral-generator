import { Resource, ResourcesSchema } from "@/types/resources";
import { getApiDomain } from "./apiDomain";
import { GenerateReferralsFromDocResponse } from "@/types/api";
import { STREAMING_TIMEOUT } from "@/config/timeouts";

/**
 * Extracts JSON from text that may contain a prefix or suffix
 * Finds the first { and matching } to extract the JSON object
 */
function extractJSON(text: string): string {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON object found in response");
  }

  // Find the matching closing brace by counting braces
  let braceCount = 0;
  let endIndex = firstBrace;

  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === "{") {
      braceCount++;
    } else if (text[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (braceCount !== 0) {
    throw new Error("Malformed JSON in response");
  }

  return text.substring(firstBrace, endIndex + 1);
}

export async function uploadPdfDocument(
  userEmail: string,
  file: File,
): Promise<Resource[]> {
  const apiDomain = await getApiDomain();
  const url = apiDomain + "generate_referrals_from_doc/run";

  const formData = new FormData();
  formData.append("files", file);
  formData.append("user_email", userEmail);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), STREAMING_TIMEOUT); // 10 minutes timeout for LLM processing

  try {
    const upstream = await fetch(url, {
      method: "POST",
      body: formData,
      cache: "no-store",
      signal: ac.signal,
    });

    clearTimeout(timer);

    if (!upstream.ok) {
      throw new Error(`HTTP error! status: ${upstream.status}`);
    }

    const responseData =
      (await upstream.json()) as GenerateReferralsFromDocResponse;
    const responseText = responseData.result.llm.replies[0]._content[0].text;
    console.log("Response text:", responseText);
    const jsonString = extractJSON(responseText);
    const resourcesJson: unknown = JSON.parse(jsonString);
    console.log("Parsed resources JSON:", resourcesJson);
    const resources = ResourcesSchema.parse(resourcesJson);
    const resourcesAsArray: Resource[] = resources.resources;

    return resourcesAsArray;
  } catch (error) {
    console.error("Error uploading PDF:", error);
    throw error;
  }
}
