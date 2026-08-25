import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export const PROJECT_BRIEF_VISIBILITY_KEY_PREFIX =
  "refurb-genius:dashboard:project-brief-visible:v1:";

export function projectBriefVisibilityKey(userId: string): string {
  return `${PROJECT_BRIEF_VISIBILITY_KEY_PREFIX}${userId}`;
}

export type ProjectBriefVisibilityState = {
  resolvedUserId: string | null;
  visible: boolean;
  hide: () => void;
  restore: () => void;
};

function readStoredVisible(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(projectBriefVisibilityKey(userId));
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

function writeStoredVisible(userId: string, visible: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(projectBriefVisibilityKey(userId), visible ? "1" : "0");
  } catch {
    // Keep in-memory preference when storage is unavailable.
  }
}

export function useProjectBriefVisibility(): ProjectBriefVisibilityState {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setResolvedUserId(null);
      setVisible(true);
      return;
    }
    setVisible(readStoredVisible(currentUserId));
    setResolvedUserId(currentUserId);
  }, [currentUserId]);

  const hide = useCallback(() => {
    if (!currentUserId) return;
    writeStoredVisible(currentUserId, false);
    setVisible(false);
    setResolvedUserId(currentUserId);
  }, [currentUserId]);

  const restore = useCallback(() => {
    if (!currentUserId) return;
    writeStoredVisible(currentUserId, true);
    setVisible(true);
    setResolvedUserId(currentUserId);
  }, [currentUserId]);

  return {
    resolvedUserId,
    visible: resolvedUserId !== currentUserId ? true : visible,
    hide,
    restore,
  };
}
