import { ShareOptionsDialog, ShareMode } from "./ShareOptionsDialog";

export type PrintMode = ShareMode;

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: PrintMode) => void;
  hasActionPlan: boolean;
}

export function PrintOptionsDialog(props: PrintOptionsDialogProps) {
  return <ShareOptionsDialog {...props} variant="print" />;
}
