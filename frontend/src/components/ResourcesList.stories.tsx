import { Meta, StoryObj } from "@storybook/react";
import { Resource } from "@/types/resources";
import ResourcesList from "./ResourcesList";

const meta: Meta<typeof ResourcesList> = {
  component: ResourcesList,
  title: "Components/ResourcesList",
};

export default meta;
type Story = StoryObj<typeof ResourcesList>;

const sampleResources: Resource[] = [
  {
    name: "Internal Career Center",
    description:
      "Provides job training, resume assistance, and career counseling services.",
    addresses: ["123 Main St, Portland, OR 97201"],
    phones: ["503-555-1234"],
    emails: ["careers@example.org"],
    website: "https://www.example.org/careers",
    referral_type: "internal",
  },
  {
    name: "Oregon Employment Department",
    description:
      "State-run employment services including unemployment insurance and job placement assistance.",
    addresses: [
      "456 State St, Portland, OR 97204",
      "789 Second Ave, Salem, OR 97301",
    ],
    phones: ["503-555-5678", "503-555-9999"],
    emails: ["info@employment.oregon.gov"],
    website: "https://www.oregon.gov/employ",
    referral_type: "government",
  },
  {
    name: "Community Action Partnership",
    description:
      "Local non-profit offering housing assistance, food programs, and family support services.",
    addresses: ["321 Community Blvd, Portland, OR 97209"],
    phones: ["503-555-3333"],
    website: "www.communityaction.org",
    referral_type: "external",
  },
];

export const EmptyList: Story = {
  args: {
    resources: [],
  },
};

export const SingleResource: Story = {
  args: {
    resources: [sampleResources[0]],
  },
};

export const MultipleResources: Story = {
  args: {
    resources: sampleResources,
  },
};

export const InternalResource: Story = {
  args: {
    resources: [
      {
        name: "Internal Resource Center",
        description: "Job training and employment services",
        addresses: ["100 Resource Way, Portland, OR"],
        phones: ["503-555-0000"],
        website: "https://example.org",
        referral_type: "internal",
      },
    ],
  },
};

export const GovernmentResource: Story = {
  args: {
    resources: [
      {
        name: "Department of Human Services",
        description: "Social services and assistance programs",
        addresses: ["200 State Building, Salem, OR"],
        phones: ["503-555-1111"],
        emails: ["dhs@oregon.gov"],
        website: "https://oregon.gov/dhs",
        referral_type: "government",
      },
    ],
  },
};

export const ExternalResource: Story = {
  args: {
    resources: [
      {
        name: "Local Community Center",
        description: "Community programs and resources",
        addresses: ["300 Community St, Portland, OR"],
        website: "https://localcenter.org",
        referral_type: "external",
      },
    ],
  },
};

export const MinimalResource: Story = {
  args: {
    resources: [
      {
        name: "Basic Resource",
        description: "A resource with minimal information",
      },
    ],
  },
};

export const ResourceWithoutWebsite: Story = {
  args: {
    resources: [
      {
        name: "Walk-In Center",
        description: "Services available in person only",
        addresses: ["555 Walk-In Ave, Portland, OR"],
        phones: ["503-555-7777"],
      },
    ],
  },
};
