// __tests__/resourceSchema.test.ts
import { ResourceSchema } from "@/types/resources";

describe("ResourceSchema", () => {
  it("parses ok when all conditions met", () => {
    const resourceWithEverythingOK = {
      name: "Capital Metro",
      addresses: ["Austin, Texas"],
      phones: ["512-474-1200", "1-800-474-1201"],
      emails: ["info@capmetro.org", "capital@metro.org"],
      website: "http://www.capitalmetro.org",
      description:
        "Public transportation service provider in Austin. Offers route planning assistance and transit information services.",
      justification:
        "Can help plan reliable transportation routes to/from work using public transit system.",
    };

    const result = ResourceSchema.safeParse(resourceWithEverythingOK);
    expect(result.success).toBe(true);
    expect(result?.data?.phones?.length).toBe(2);
    expect(result?.data?.emails?.[0]).toBe("info@capmetro.org");
  });

  it("parses a resource with empty emails and empty website", () => {
    const resourceWithoutEmailsOrWebsite = {
      name: "Capital Metro",
      addresses: ["Austin, Texas"],
      phones: ["512-474-1200", "1-800-474-1201"],
      emails: [], // empty array is fine
      website: "",
      description:
        "Public transportation service provider in Austin. Offers route planning assistance and transit information services.",
      justification:
        "Can help plan reliable transportation routes to/from work using public transit system.",
    };

    const result = ResourceSchema.safeParse(resourceWithoutEmailsOrWebsite);

    expect(result.success).toBe(true);
    expect(result?.data?.website).toBeDefined();
    expect(result?.data?.website).toBe(""); // explicit empty string
    expect(Array.isArray(result?.data?.emails)).toBe(true);
    expect(result?.data?.emails?.length).toBe(0); // empty array preserved
  });

  it("parses when website is omitted entirely", () => {
    const resourceWithoutWebsite = {
      name: "Capital Metro",
      addresses: ["Austin, Texas"],
      phones: ["512-474-1200", "1-800-474-1201"],
      emails: [],
      description:
        "Public transportation service provider in Austin. Offers route planning assistance and transit information services.",
      justification:
        "Can help plan reliable transportation routes to/from work using public transit system.",
    };

    const result = ResourceSchema.safeParse(resourceWithoutWebsite);

    expect(result.success).toBe(true);
    expect(result?.data?.website).toBeUndefined(); // missing field is fine
  });

  it("parses when emails are omitted", () => {
    const resourceWithoutEmails = {
      name: "Capital Metro",
      website: "https://capmetro.org",
    };

    const result = ResourceSchema.safeParse(resourceWithoutEmails);
    expect(result.success).toBe(true);
    expect(result?.data?.emails).toBeUndefined();
  });

  it("fails when name is missing", () => {
    const resourceWithNoName = {
      addresses: ["Austin, Texas"],
      phones: ["512-474-1200", "1-800-474-1201"],
      emails: [],
      description:
        "Public transportation service provider in Austin. Offers route planning assistance and transit information services.",
      justification:
        "Can help plan reliable transportation routes to/from work using public transit system.",
    };

    const result = ResourceSchema.safeParse(resourceWithNoName);
    expect(result.success).toBe(false);
  });
});
