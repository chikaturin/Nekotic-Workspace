"use client";

import { useEffect } from "react";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { Spinner } from "@/components/ui/spinner";
import { useSessionStore } from "@/store/session-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export function SessionGate({ children }: { children: React.ReactNode }) {
  const status = useSessionStore((state) => state.status);
  const restore = useSessionStore((state) => state.restore);
  const workspaces = useSessionStore((state) => state.workspaces);
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const hydrate = useWorkspaceStore((state) => state.hydrate);
  const clearWorkspaces = useWorkspaceStore((state) => state.clear);

  useEffect(() => {
    if (status === "idle") void restore();
  }, [status, restore]);

  useEffect(() => {
    if (status === "signed-out") clearWorkspaces();
  }, [status, clearWorkspaces]);

  useEffect(() => {
    if (activeWorkspaceId === null) return;

    useWorkspaceStore.setState({ workspaces, activeWorkspaceId });
    void hydrate(activeWorkspaceId);
  }, [workspaces, activeWorkspaceId, hydrate]);

  if (status === "idle" || status === "restoring") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <Spinner />
      </div>
    );
  }

  if (status === "signed-out") return <SignInScreen />;

  return <>{children}</>;
}
