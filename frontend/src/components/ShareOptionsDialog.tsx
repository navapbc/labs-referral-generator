import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, List } from "lucide-react";

export type ShareMode = "action-plan-only" | "full-referrals";

interface ShareOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: ShareMode) => void;
  hasActionPlan: boolean;
  /** "print" or "email" - affects title text and test IDs */
  variant: "print" | "email";
}

export function ShareOptionsDialog({
  open,
  onOpenChange,
  onSelectMode,
  hasActionPlan,
  variant,
}: ShareOptionsDialogProps) {
  const handleSelect = (mode: ShareMode) => {
    onSelectMode(mode);
    onOpenChange(false);
  };

  const descriptionId = `${variant}-options-description`;
  const actionPlanDescId = `${variant}-action-plan-only-desc`;
  const fullReferralsDescId = `${variant}-full-referrals-desc`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={descriptionId}>
        <DialogHeader>
          <DialogTitle>What would you like to {variant}?</DialogTitle>
          <DialogDescription id={descriptionId}>
            Choose what to include in your{" "}
            {variant === "print" ? "printed report" : "email"}.
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex flex-col gap-3 mt-4"
          role="group"
          aria-label={`${variant.charAt(0).toUpperCase() + variant.slice(1)} options`}
        >
          {hasActionPlan && (
            <Button
              variant="outline"
              className="h-auto py-4 px-5 justify-start text-left border-gray-300 hover:bg-blue-50 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => handleSelect("action-plan-only")}
              data-testid={`${variant}-action-plan-only`}
              aria-describedby={actionPlanDescId}
            >
              <FileText
                className="w-5 h-5 mr-3 flex-shrink-0 text-blue-700"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  Action Plan Only
                </div>
                <div
                  id={actionPlanDescId}
                  className="text-sm text-gray-700 font-normal"
                >
                  Includes contact info for selected resources (no descriptions)
                </div>
              </div>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-auto py-4 px-5 justify-start text-left border-gray-300 hover:bg-blue-50 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => handleSelect("full-referrals")}
            data-testid={`${variant}-full-referrals`}
            aria-describedby={fullReferralsDescId}
          >
            <List
              className="w-5 h-5 mr-3 flex-shrink-0 text-blue-700"
              aria-hidden="true"
            />
            <div>
              <div className="font-semibold text-gray-900">
                {hasActionPlan
                  ? "Action Plan + Full Referrals"
                  : "Full Referrals"}
              </div>
              <div
                id={fullReferralsDescId}
                className="text-sm text-gray-700 font-normal"
              >
                Includes complete resource details with descriptions
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
