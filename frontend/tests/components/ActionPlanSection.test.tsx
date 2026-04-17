import { render, screen } from "tests/react-utils";
import userEvent from "@testing-library/user-event";
import { ActionPlanSection } from "src/components/ActionPlanSection";
import { Resource } from "src/types/resources";

// Mock only the markdown parser to avoid ESM module issues
jest.mock("src/util/markdown", () => ({
  parseMarkdownToHTML: jest.fn((content: string) => `<div>${content}</div>`),
  extractCitations: jest.fn((content: string) => ({ content, citations: [] })),
}));

describe("ActionPlanSection", () => {
  const mockResources: Resource[] = [
    { name: "Resource 1", description: "First resource" },
    { name: "Resource 2", description: "Second resource" },
  ];

  const mockActionPlan = {
    title: "Test Action Plan",
    summary: "Test summary",
    content: "## Test Content",
  };

  const defaultProps = {
    resources: mockResources,
    selectedResources: [],
    actionPlan: null,
    isGeneratingActionPlan: false,
    onResourceSelection: jest.fn(),
    onSelectAllResources: jest.fn(),
    onGenerateActionPlan: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders resource selection UI", () => {
    render(<ActionPlanSection {...defaultProps} />);

    expect(
      screen.getByText("Select Resources for Action Plan"),
    ).toBeInTheDocument();
    expect(screen.getByText("Resource 1")).toBeInTheDocument();
    expect(screen.getByText("Resource 2")).toBeInTheDocument();
  });

  it("calls onResourceSelection when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<ActionPlanSection {...defaultProps} />);

    const checkbox = screen.getByLabelText(/Resource 1/);
    await user.click(checkbox);

    expect(defaultProps.onResourceSelection).toHaveBeenCalledWith(
      mockResources[0],
      true,
    );
  });

  it("calls onSelectAllResources when Select All button is clicked", async () => {
    const user = userEvent.setup();
    render(<ActionPlanSection {...defaultProps} />);

    const selectAllButton = screen.getByText("Select All");
    await user.click(selectAllButton);

    expect(defaultProps.onSelectAllResources).toHaveBeenCalled();
  });

  it("shows Generate Action Plan button when resources are selected", () => {
    render(
      <ActionPlanSection
        {...defaultProps}
        selectedResources={[mockResources[0]]}
      />,
    );

    expect(
      screen.getByText(/Generate Action Plan \(1 selected\)/),
    ).toBeInTheDocument();
  });

  it("does not show Generate Action Plan button when no resources selected", () => {
    render(<ActionPlanSection {...defaultProps} />);

    expect(screen.queryByText(/Generate Action Plan/)).not.toBeInTheDocument();
  });

  it("displays action plan when provided", () => {
    render(<ActionPlanSection {...defaultProps} actionPlan={mockActionPlan} />);

    expect(screen.getByText("Test Action Plan")).toBeInTheDocument();
    expect(screen.getByText("Test summary")).toBeInTheDocument();
  });

  it("shows loading state when generating", () => {
    render(
      <ActionPlanSection
        {...defaultProps}
        selectedResources={[mockResources[0]]}
        isGeneratingActionPlan={true}
      />,
    );

    expect(screen.getByText("Generating Action Plan...")).toBeInTheDocument();
  });
});
