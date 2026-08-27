"use client";

import { Building2, ShieldOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import { useMyWorkspaces, useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * The outermost gate (SY-WSA).
 *
 * Nothing inside a workspace renders until membership is settled. That
 * ordering is the point: a shell that mounts the drive and *then* checks has
 * already fetched a tree, filled a cache and painted a breadcrumb for
 * somebody who should never have had any of it.
 *
 * Two screens, and they are different questions:
 *
 *   - no workspaces at all — a first run, which offers the way forward,
 *   - a workspace that is not theirs — a refusal, which names nothing.
 *
 * The refusal answers the same way for a workspace that does not exist as for
 * one they are not in, so the URL cannot be used to find out which workspaces
 * are real. None of this is enforcement: the backend still has to refuse every
 * request the shell would have made.
 */
export function WorkspaceGuard({ children }: { readonly children: ReactNode }) {
  const access = useWorkspaceAccess();
  const mine = useMyWorkspaces();

  if (access.isAllowed) return <>{children}</>;
  if (mine.length === 0) return <NoWorkspaces />;

  return <NoAccess />;
}

function NoWorkspaces() {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Frame
      icon={<Building2 className="size-5 text-faint-foreground" />}
      title="No workspace yet"
      body="Create one to get started, or wait for somebody to invite you to theirs."
      action={
        <Button size="sm" onClick={() => setIsCreating(true)}>
          Create workspace
        </Button>
      }
    >
      <CreateWorkspaceDialog isOpen={isCreating} onClose={() => setIsCreating(false)} />
    </Frame>
  );
}

function NoAccess() {
  const mine = useMyWorkspaces();
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  return (
    <Frame
      icon={<ShieldOff className="size-5 text-faint-foreground" />}
      title="You don't have access to this workspace"
      body="Ask somebody who does to invite you, or go back to the workspaces you are in."
      action={
        <Button
          size="sm"
          onClick={() => {
            const first = mine[0];
            if (first) setActiveWorkspace(first.id);
          }}
        >
          Back to workspaces
        </Button>
      }
    />
  );
}

function Frame({
  icon,
  title,
  body,
  action,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly action: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
          {icon}
        </span>
        <h1 className="text-[15px] font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">{body}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </div>
      {children}
    </div>
  );
}
