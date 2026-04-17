import { axe } from "jest-axe";
import { render, screen } from "tests/react-utils";
import { Resource } from "@/types/resources";
import ResourcesList, { getCardBorderClass } from "./ResourcesList";

const mockResource: Resource = {
  name: "Test Resource",
  description: "Test description",
  addresses: ["123 Test St"],
  phones: ["555-1234"],
  emails: ["test@example.com"],
  website: "https://example.com",
  referral_type: "internal",
};

describe("ResourcesList", () => {
  let mockHandleRemoveResource: jest.Mock;

  beforeEach(() => {
    mockHandleRemoveResource = jest.fn();
  });

  it("renders 'No resources found' when list is empty", () => {
    render(
      <ResourcesList
        resources={[]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByText("No resources found.")).toBeInTheDocument();
  });

  it("renders single resource with all fields", () => {
    render(
      <ResourcesList
        resources={[mockResource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByText("Test Resource")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText(/123 Test St/)).toBeInTheDocument();
    expect(screen.getByText(/555-1234/)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("renders multiple resources", () => {
    const resources: Resource[] = [
      { name: "Resource 1", description: "First resource" },
      { name: "Resource 2", description: "Second resource" },
      { name: "Resource 3", description: "Third resource" },
    ];

    render(
      <ResourcesList
        resources={resources}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByText("Resource 1")).toBeInTheDocument();
    expect(screen.getByText("Resource 2")).toBeInTheDocument();
    expect(screen.getByText("Resource 3")).toBeInTheDocument();
  });

  it("displays internal referral type indicator", () => {
    const resource: Resource = {
      name: "Internal Center",
      referral_type: "internal",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByTestId("internal_referral")).toBeInTheDocument();
  });

  it("displays government referral type indicator", () => {
    const resource: Resource = {
      name: "Government Service",
      referral_type: "government",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByTestId("government_referral")).toBeInTheDocument();
  });

  it("displays external referral type indicator", () => {
    const resource: Resource = {
      name: "Community Center",
      referral_type: "external",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByTestId("external_referral")).toBeInTheDocument();
  });

  it("does not display referral type indicator when undefined", () => {
    const resource: Resource = {
      name: "Generic Resource",
      description: "No type specified",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.queryByText("Internal")).not.toBeInTheDocument();
    expect(screen.queryByText("Government")).not.toBeInTheDocument();
    expect(screen.queryByText("External")).not.toBeInTheDocument();
  });

  describe("Card border styling", () => {
    it("applies blue border class for internal referral type", () => {
      const resource: Resource = {
        name: "Internal Center",
        referral_type: "internal",
      };

      render(
        <ResourcesList
          resources={[resource]}
          handleRemoveResource={mockHandleRemoveResource}
        />,
      );

      const expectedClasses = getCardBorderClass("internal");
      const card = screen.getByTestId("resource-card-internal-0");
      expect(card).toBeInTheDocument();
      expectedClasses.split(" ").forEach((className) => {
        expect(card).toHaveClass(className);
      });
    });

    it("applies gray border class for government referral type", () => {
      const resource: Resource = {
        name: "Government Service",
        referral_type: "government",
      };

      render(
        <ResourcesList
          resources={[resource]}
          handleRemoveResource={mockHandleRemoveResource}
        />,
      );

      const expectedClasses = getCardBorderClass("government");
      const card = screen.getByTestId("resource-card-government-0");
      expect(card).toBeInTheDocument();
      expectedClasses.split(" ").forEach((className) => {
        expect(card).toHaveClass(className);
      });
    });

    it("applies green border class for external referral type", () => {
      const resource: Resource = {
        name: "Community Center",
        referral_type: "external",
      };

      render(
        <ResourcesList
          resources={[resource]}
          handleRemoveResource={mockHandleRemoveResource}
        />,
      );

      const expectedClasses = getCardBorderClass("external");
      const card = screen.getByTestId("resource-card-external-0");
      expect(card).toBeInTheDocument();
      expectedClasses.split(" ").forEach((className) => {
        expect(card).toHaveClass(className);
      });
    });

    it("does not apply border classes when referral type is undefined", () => {
      const resource: Resource = {
        name: "Generic Resource",
        description: "No type specified",
      };

      render(
        <ResourcesList
          resources={[resource]}
          handleRemoveResource={mockHandleRemoveResource}
        />,
      );

      const expectedClasses = getCardBorderClass(undefined);
      expect(expectedClasses).toBe("border-t-4 border-t-gray-300 rounded-t-lg");

      const card = screen.getByTestId("resource-card-0");
      expect(card).toBeInTheDocument();

      // Verify loading state border is applied (gray-300), not the typed borders
      expect(card).toHaveClass("border-t-gray-300");
      expect(card).not.toHaveClass("border-t-blue-600");
      expect(card).not.toHaveClass("border-t-gray-600");
      expect(card).not.toHaveClass("border-t-green-600");
    });

    it("applies correct border classes to multiple resources with different types", () => {
      const resources: Resource[] = [
        { name: "Internal Center", referral_type: "internal" },
        { name: "Government Service", referral_type: "government" },
        { name: "Community Center", referral_type: "external" },
      ];

      render(
        <ResourcesList
          resources={resources}
          handleRemoveResource={mockHandleRemoveResource}
        />,
      );

      const internalClasses = getCardBorderClass("internal");
      const governmentClasses = getCardBorderClass("government");
      const externalClasses = getCardBorderClass("external");

      const internalCard = screen.getByTestId("resource-card-internal-0");
      const govCard = screen.getByTestId("resource-card-government-1");
      const externalCard = screen.getByTestId("resource-card-external-2");

      internalClasses.split(" ").forEach((className) => {
        expect(internalCard).toHaveClass(className);
      });
      governmentClasses.split(" ").forEach((className) => {
        expect(govCard).toHaveClass(className);
      });
      externalClasses.split(" ").forEach((className) => {
        expect(externalCard).toHaveClass(className);
      });
    });
  });

  it("renders website link with proper attributes", () => {
    render(
      <ResourcesList
        resources={[mockResource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    const link = screen.getByTestId("website-link-0");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("normalizes website URLs without protocol", () => {
    const resource: Resource = {
      name: "Test Resource",
      website: "example.com",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    const link = screen.getByTestId("website-link-0");
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("handles multiple addresses separated by pipe", () => {
    const resource: Resource = {
      name: "Multi-Location Resource",
      addresses: ["123 Main St", "456 Oak Ave", "789 Pine Rd"],
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(
      screen.getByText(/123 Main St \| 456 Oak Ave \| 789 Pine Rd/),
    ).toBeInTheDocument();
  });

  it("handles multiple phone numbers separated by pipe", () => {
    const resource: Resource = {
      name: "Contact Resource",
      phones: ["555-1111", "555-2222"],
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByText(/555-1111 \| 555-2222/)).toBeInTheDocument();
  });

  it("displays resource index numbers correctly", () => {
    const resources: Resource[] = [
      { name: "First" },
      { name: "Second" },
      { name: "Third" },
    ];

    render(
      <ResourcesList
        resources={resources}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("only renders fields that have values", () => {
    const resource: Resource = {
      name: "Minimal Resource",
    };

    render(
      <ResourcesList
        resources={[resource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );

    expect(screen.queryByText(/Address/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phone/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Email/)).not.toBeInTheDocument();
  });

  it("passes accessibility scan with single resource", async () => {
    const { container } = render(
      <ResourcesList
        resources={[mockResource]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("passes accessibility scan with empty list", async () => {
    const { container } = render(
      <ResourcesList
        resources={[]}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("passes accessibility scan with multiple resources", async () => {
    const resources: Resource[] = [
      { name: "Resource 1", description: "First" },
      { name: "Resource 2", description: "Second" },
    ];

    const { container } = render(
      <ResourcesList
        resources={resources}
        handleRemoveResource={mockHandleRemoveResource}
      />,
    );
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
