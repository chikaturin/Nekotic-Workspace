"use client";

import { useState } from "react";
import { WorkspaceDangerZone } from "@/components/workspace/workspace-danger-zone";
import { WorkspaceGeneralTab } from "@/components/workspace/workspace-general-tab";
import { WorkspaceMembersTab } from "@/components/workspace/workspace-members-tab";
import { WorkspaceRestrictedTab } from "@/components/workspace/workspace-restricted-tab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { PermissionKey, PermissionResolver } from "@/types";

type TabId = "general" | "members" | "access" | "danger";

interface TabSpec {
  readonly id: TabId;
  readonly label: string;
  /** The key that decides whether the tab is offered at all. */
  readonly needs: PermissionKey;
}

const TABS: readonly TabSpec[] = [
  { id: "general", label: "General", needs: "workspace.settings.view" },
  { id: "members", label: "Members", needs: "workspace.member.manage" },
  { id: "access", label: "Access", needs: "workspace.permission.manage" },
  { id: "danger", label: "Danger zone", needs: "workspace.delete" },
];

interface WorkspaceSettingsDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Workspace settings.
 *
 * Every tab declares the permission that reveals it, and the dialog renders
 * only the ones `can` returns true for — so "who may see Members" is a line in
 * the catalogue rather than a role test buried in a component. A person with
 * none of the keys never reaches this surface: the switcher does not offer it.
 *
 * None of this is enforcement. Hiding the tab is a courtesy; the backend still
 * has to refuse every call the tab would have made.
 */
export function WorkspaceSettingsDialog({ isOpen, onClose }: WorkspaceSettingsDialogProps) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const can = usePermissions();
  const allowed = TABS.filter((tab) => can(tab.needs));

  const [tab, setTab] = useState<TabId>("general");
  const active = allowed.find((candidate) => candidate.id === tab) ?? allowed[0] ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[min(46rem,92vw)] max-w-none flex-col p-0">
        <header className="border-b border-border px-5 pt-5 pb-0">
          <DialogTitle className="text-title">Workspace settings</DialogTitle>
          <DialogDescription className="mt-1 text-ui text-muted-foreground">
            {workspace.name}
          </DialogDescription>

          <nav className="-mb-px flex gap-1 pt-3" aria-label="Settings sections">
            {allowed.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                aria-current={candidate.id === active?.id}
                onClick={() => setTab(candidate.id)}
                className={cn(
                  "rounded-t-md border-b-2 px-2.5 py-1.5 text-ui transition-colors",
                  candidate.id === active?.id
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-hover",
                )}
              >
                {candidate.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <SettingsBody tab={active?.id ?? null} can={can} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({
  tab,
  can,
  onClose,
}: {
  readonly tab: TabId | null;
  readonly can: PermissionResolver;
  readonly onClose: () => void;
}) {
  if (tab === null) {
    return (
      <p className="text-ui text-muted-foreground">
        You do not have access to any workspace settings.
      </p>
    );
  }

  if (tab === "members") return <WorkspaceMembersTab />;
  if (tab === "access") return <WorkspaceRestrictedTab />;
  if (tab === "danger") return <WorkspaceDangerZone onDeleted={onClose} />;

  return <WorkspaceGeneralTab canEdit={can("workspace.manage")} />;
}
