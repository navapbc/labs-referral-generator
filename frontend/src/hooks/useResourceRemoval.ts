import { useState, useCallback } from "react";
import { Resource } from "@/types/resources";
import { UNDO_NOTIFICATION_TIMEOUT } from "@/config/timeouts";

export interface UseResourceRemovalReturn {
  recentlyRemoved: Resource | null;
  removedResourceIndex: number | null;
  handleRemoveResource: (
    resourceToRemove: Resource,
    currentResources?: Resource[],
  ) => void;
  handleUndoRemove: (
    onRestore: (resource: Resource, index: number | null) => void,
  ) => void;
}

/**
 * Custom hook to handle resource removal and undo functionality
 */
export function useResourceRemoval(): UseResourceRemovalReturn {
  const [recentlyRemoved, setRecentlyRemoved] = useState<Resource | null>(null);
  const [removedResourceIndex, setRemovedResourceIndex] = useState<
    number | null
  >(null);

  const handleRemoveResource = useCallback(
    (resourceToRemove: Resource, currentResources?: Resource[]) => {
      // Find and store the index before removing
      const index = currentResources?.findIndex(
        (r) => r.name === resourceToRemove.name,
      );
      if (index !== undefined && index !== -1) {
        setRemovedResourceIndex(index);
      }

      setRecentlyRemoved(resourceToRemove);

      // Auto-clear the undo notification after timeout period
      setTimeout(() => {
        setRecentlyRemoved((current) => {
          // If the resource is still marked as recently removed, clear it
          if (current === resourceToRemove) {
            return null;
          }
          return current;
        });
        setRemovedResourceIndex(null);
      }, UNDO_NOTIFICATION_TIMEOUT);
    },
    [],
  );

  const handleUndoRemove = useCallback(
    (onRestore: (resource: Resource, index: number | null) => void) => {
      if (recentlyRemoved) {
        onRestore(recentlyRemoved, removedResourceIndex);
        setRecentlyRemoved(null);
        setRemovedResourceIndex(null);
      }
    },
    [recentlyRemoved, removedResourceIndex],
  );

  return {
    recentlyRemoved,
    removedResourceIndex,
    handleRemoveResource,
    handleUndoRemove,
  };
}
