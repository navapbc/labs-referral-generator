import { RotateCcw } from "lucide-react";

type RemoveResourceNotificationProps = {
  handleUndoRemove: () => void;
};
export function RemoveResourceNotification({
  handleUndoRemove,
}: RemoveResourceNotificationProps) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-xs">ℹ️</span>
          </div>
          <span className="text-sm font-medium">Resource removed</span>
        </div>
        <button
          onClick={handleUndoRemove}
          aria-label="Undo resource removal"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-900 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>
    </div>
  );
}
