"use client";

import { Building2, ShieldOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import { useMyWorkspaces, useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { useWorkspaceStore } from "@/store/workspace-store";

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
        <h1 className="text-title font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-ui text-muted-foreground">{body}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </div>
      {children}
    </div>
  );
}
