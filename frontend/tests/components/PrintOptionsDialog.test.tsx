import { render, screen } from "tests/react-utils";
import userEvent from "@testing-library/user-event";
import { PrintOptionsDialog } from "src/components/PrintOptionsDialog";

describe("PrintOptionsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSelectMode: jest.fn(),
    hasActionPlan: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows both options when hasActionPlan is true", () => {
    render(<PrintOptionsDialog {...defaultProps} />);

    expect(screen.getByText("Action Plan Only")).toBeInTheDocument();
    expect(
      screen.getByText("Action Plan + Full Referrals"),
    ).toBeInTheDocument();
  });

  it("shows only Full Referrals option when hasActionPlan is false", () => {
    render(<PrintOptionsDialog {...defaultProps} hasActionPlan={false} />);

    expect(screen.queryByText("Action Plan Only")).not.toBeInTheDocument();
    expect(screen.getByText("Full Referrals")).toBeInTheDocument();
  });

  it("calls onSelectMode with 'action-plan-only' when Action Plan Only is clicked", async () => {
    const user = userEvent.setup();
    render(<PrintOptionsDialog {...defaultProps} />);

    const actionPlanButton = screen.getByTestId("print-action-plan-only");
    await user.click(actionPlanButton);

    expect(defaultProps.onSelectMode).toHaveBeenCalledWith("action-plan-only");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onSelectMode with 'full-referrals' when Full Referrals is clicked", async () => {
    const user = userEvent.setup();
    render(<PrintOptionsDialog {...defaultProps} />);

    const fullReferralsButton = screen.getByTestId("print-full-referrals");
    await user.click(fullReferralsButton);

    expect(defaultProps.onSelectMode).toHaveBeenCalledWith("full-referrals");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("has proper accessibility attributes", () => {
    render(<PrintOptionsDialog {...defaultProps} />);

    const optionsGroup = screen.getByRole("group", { name: "Print options" });
    expect(optionsGroup).toBeInTheDocument();
  });
});
