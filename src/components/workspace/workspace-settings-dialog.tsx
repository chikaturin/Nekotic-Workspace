"use client";

import { useState } from "react";
import { WorkspaceDangerZone } from "@/components/workspace/workspace-danger-zone";
import { WorkspaceGeneralTab } from "@/components/workspace/workspace-general-tab";
import { WorkspaceMembersTab } from "@/components/workspace/workspace-members-tab";
import { WorkspaceRestrictedTab } from "@/components/workspace/workspace-restricted-tab";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/use-permissions";
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
      <DialogContent size="xl" className="flex max-h-[85vh] flex-col">
        <Tabs
          variant="underline"
          value={active?.id ?? ""}
          onValueChange={(next) => {
            // Looked up rather than cast: the strip only ever reports one of
            // these ids back, and the lookup is what says so to the compiler.
            const chosen = TABS.find((candidate) => candidate.id === next);
            if (chosen) setTab(chosen.id);
          }}
          className="min-h-0 flex-1"
        >
          {/* The rule under this block belongs to the tab strip below, which
              draws its own and hangs the active indicator off it. A second
              border here would read as two lines with the tabs trapped
              between them. */}
          <DialogHeader className="border-b-0">
            <DialogTitle>Workspace settings</DialogTitle>
            <DialogDescription>{workspace.name}</DialogDescription>
          </DialogHeader>

          <TabsList aria-label="Settings sections">
            {allowed.map((candidate) => (
              <TabsTrigger key={candidate.id} value={candidate.id}>
                {candidate.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <DialogBody>
            {active === null ? (
              <p className="text-ui text-muted-foreground">
                You do not have access to any workspace settings.
              </p>
            ) : (
              // One panel per permitted tab, and only the selected one is
              // mounted — `TabsContent` returns nothing for the rest, so the
              // members table and the restricted-folder list are not built
              // behind a tab nobody is looking at.
              allowed.map((candidate) => (
                <TabsContent key={candidate.id} value={candidate.id}>
                  <SettingsBody tab={candidate.id} can={can} onClose={onClose} />
                </TabsContent>
              ))
            )}
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({
  tab,
  can,
  onClose,
}: {
  readonly tab: TabId;
  readonly can: PermissionResolver;
  readonly onClose: () => void;
}) {
  if (tab === "members") return <WorkspaceMembersTab />;
  if (tab === "access") return <WorkspaceRestrictedTab />;
  if (tab === "danger") return <WorkspaceDangerZone onDeleted={onClose} />;

  return <WorkspaceGeneralTab canEdit={can("workspace.manage")} />;
}
