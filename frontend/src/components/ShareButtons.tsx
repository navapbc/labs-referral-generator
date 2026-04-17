import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailReferralsButton } from "@/components/EmailReferralsButton";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  onPrint: () => void;
  resourcesResultId: string;
  actionPlanResultId: string;
  userEmail: string;
  excludedResourceNames?: string[];
  className?: string;
  testIdSuffix?: string;
  disabled?: boolean;
}

export function ShareButtons({
  onPrint,
  resourcesResultId,
  actionPlanResultId,
  userEmail,
  excludedResourceNames = [],
  className,
  testIdSuffix,
  disabled = false,
}: ShareButtonsProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        onClick={onPrint}
        variant="outline"
        className="text-gray-900 border-gray-400 hover:bg-gray-100 hover:text-gray-900"
        data-testid={`printReferralsButton${testIdSuffix ? `-${testIdSuffix}` : ""}`}
        disabled={disabled}
      >
        <Printer className="w-4 h-4" aria-hidden="true" />
        Print
      </Button>
      {resourcesResultId && (
        <EmailReferralsButton
          resultId={resourcesResultId}
          actionPlanResultId={actionPlanResultId || undefined}
          requestorEmail={userEmail}
          excludedResourceNames={excludedResourceNames}
          disabled={disabled}
        />
      )}
    </div>
  );
}
