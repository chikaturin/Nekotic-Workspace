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
  readonly initialTab?: TabId;
  readonly onClose: () => void;
}

export function WorkspaceSettingsDialog({
  isOpen,
  initialTab = "general",
  onClose,
}: WorkspaceSettingsDialogProps) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const can = usePermissions();
  const allowed = TABS.filter((tab) => can(tab.needs));

  const [tab, setTab] = useState<TabId>(initialTab);
  const active = allowed.find((candidate) => candidate.id === tab) ?? allowed[0] ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="flex max-h-[85vh] flex-col">
        <Tabs
          variant="underline"
          value={active?.id ?? ""}
          onValueChange={(next) => {
            const chosen = TABS.find((candidate) => candidate.id === next);
            if (chosen) setTab(chosen.id);
          }}
          className="min-h-0 flex-1"
        >
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
