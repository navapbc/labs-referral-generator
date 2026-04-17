import { render, screen } from "tests/react-utils";
import { CompactResourceList } from "src/components/CompactResourceList";
import { Resource } from "src/types/resources";

describe("CompactResourceList", () => {
  const mockResources: Resource[] = [
    {
      name: "Food Bank of Central Texas",
      addresses: ["6500 Metropolis Dr, Austin, TX 78744"],
      phones: ["(512) 684-2550"],
      emails: ["info@centraltexasfoodbank.org"],
      website: "https://www.centraltexasfoodbank.org",
      description: "Provides food assistance to families in need",
      justification: "Client needs food assistance",
    },
    {
      name: "Austin Community Health Center",
      addresses: ["123 Main St, Austin, TX 78701"],
      phones: ["(512) 555-1234"],
      emails: ["contact@austinhealth.org"],
      website: "https://www.austinhealth.org",
      description: "Affordable healthcare services",
      justification: "Client needs healthcare access",
    },
  ];

  it("displays resource names", () => {
    render(<CompactResourceList resources={mockResources} />);

    expect(screen.getByText("Food Bank of Central Texas")).toBeInTheDocument();
    expect(
      screen.getByText("Austin Community Health Center"),
    ).toBeInTheDocument();
  });

  it("displays resource addresses", () => {
    render(<CompactResourceList resources={mockResources} />);

    expect(
      screen.getByText("6500 Metropolis Dr, Austin, TX 78744"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("123 Main St, Austin, TX 78701"),
    ).toBeInTheDocument();
  });

  it("displays resource phone numbers", () => {
    render(<CompactResourceList resources={mockResources} />);

    expect(screen.getByText("(512) 684-2550")).toBeInTheDocument();
    expect(screen.getByText("(512) 555-1234")).toBeInTheDocument();
  });

  it("displays resource emails", () => {
    render(<CompactResourceList resources={mockResources} />);

    expect(
      screen.getByText("info@centraltexasfoodbank.org"),
    ).toBeInTheDocument();
    expect(screen.getByText("contact@austinhealth.org")).toBeInTheDocument();
  });

  it("displays resource websites as links", () => {
    render(<CompactResourceList resources={mockResources} />);

    const link1 = screen.getByRole("link", {
      name: /centraltexasfoodbank\.org/,
    });
    const link2 = screen.getByRole("link", { name: /austinhealth\.org/ });

    expect(link1).toHaveAttribute(
      "href",
      "https://www.centraltexasfoodbank.org",
    );
    expect(link2).toHaveAttribute("href", "https://www.austinhealth.org");
    expect(link1).toHaveAttribute("target", "_blank");
    expect(link2).toHaveAttribute("target", "_blank");
  });

  it("does not display descriptions (compact mode)", () => {
    render(<CompactResourceList resources={mockResources} />);

    expect(
      screen.queryByText("Provides food assistance to families in need"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Affordable healthcare services"),
    ).not.toBeInTheDocument();
  });

  it("returns null when resources array is empty", () => {
    const { container } = render(<CompactResourceList resources={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("handles resources with missing contact info", () => {
    const resourceWithMissingInfo: Resource[] = [
      {
        name: "Minimal Resource",
        description: "A resource with minimal info",
      },
    ];

    render(<CompactResourceList resources={resourceWithMissingInfo} />);

    expect(screen.getByText("Minimal Resource")).toBeInTheDocument();
    // Should not throw errors for missing fields
  });

  it("has proper semantic structure", () => {
    render(<CompactResourceList resources={mockResources} />);

    // Check for semantic elements
    expect(
      screen.getByRole("region", { name: /Selected Resources/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("provides screen reader labels for contact info types", () => {
    render(<CompactResourceList resources={mockResources} />);

    // Check for sr-only labels
    expect(screen.getAllByText("Address")).toHaveLength(2);
    expect(screen.getAllByText("Phone")).toHaveLength(2);
    expect(screen.getAllByText("Website")).toHaveLength(2);
    expect(screen.getAllByText("Email")).toHaveLength(2);
  });
});
