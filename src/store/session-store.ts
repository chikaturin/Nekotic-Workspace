"use client";

import { create } from "zustand";
import { authService, type Session } from "@/services/auth-service";
import { clearAccessToken } from "@/services/http/access-token";
import type { UserSummary, Workspace } from "@/types";

export type SessionStatus = "idle" | "restoring" | "ready" | "signed-out";

interface SessionState {
  readonly status: SessionStatus;
  readonly user: UserSummary | null;
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string | null;
}

interface SessionActions {
  restore: () => Promise<boolean>;
  signIn: (session: Session) => void;
  signOut: () => Promise<void>;
}

export type SessionStore = SessionState & SessionActions;

const SIGNED_OUT: SessionState = {
  status: "signed-out",
  user: null,
  workspaces: [],
  activeWorkspaceId: null,
};

export const useSessionStore = create<SessionStore>()((set, get) => ({
  status: "idle",
  user: null,
  workspaces: [],
  activeWorkspaceId: null,

  restore: async () => {
    if (get().status === "restoring") return false;

    set({ status: "restoring" });

    const session = await authService.restore();

    if (session === null) {
      set(SIGNED_OUT);

      return false;
    }

    get().signIn(session);

    return true;
  },

  signIn: (session) =>
    set({
      status: "ready",
      user: session.user,
      workspaces: session.workspaces,
      activeWorkspaceId:
        session.activeWorkspaceId ?? session.workspaces[0]?.id ?? null,
    }),

  signOut: async () => {
    try {
      await authService.logout();
    } catch {
    } finally {
      clearAccessToken();
      set(SIGNED_OUT);
    }
  },
}));

export function currentUser(): UserSummary {
  const { user } = useSessionStore.getState();

  if (user === null) {
    throw new Error("No signed-in user — call restore() before writing.");
  }

  return user;
}

export const currentUserOrNull = (): UserSummary | null =>
  useSessionStore.getState().user;

export const currentUserId = (): string =>
  useSessionStore.getState().user?.id ?? "";

export const useCurrentUser = (): UserSummary | null =>
  useSessionStore((state) => state.user);

export const useCurrentUserId = (): string =>
  useSessionStore((state) => state.user?.id ?? "");

export const ANONYMOUS_USER: UserSummary = Object.freeze({
  id: "",
  name: "",
  email: "",
  initials: "",
});
