"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AccessList } from "@/components/permissions/access-list";
import { RoleMatrix } from "@/components/permissions/role-matrix";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessList, useEffectiveRole, usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS, ROLE_SUMMARIES } from "@/lib/permissions";
import { findPathToId } from "@/lib/tree";
import {
  selectPreviewRole,
  usePermissionStore,
} from "@/store/permission-store";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { WORKSPACE_ROLES, type AccessSubject, type DriveNode, type WorkspaceRole } from "@/types";

type TabId = "access" | "roles";

const TABS: readonly { readonly id: TabId; readonly label: string }[] = [
  { id: "access", label: "Access" },
  { id: "roles", label: "Roles" },
];

const SELF_VALUE = "self";

const PREVIEW_ROLE_OPTIONS: readonly ListboxOption[] = WORKSPACE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_SUMMARIES[role],
}));

interface PermissionDialogProps {
  readonly node: DriveNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function PermissionDialog({ node, isOpen, onClose }: PermissionDialogProps) {
  const [tab, setTab] = useState<TabId>("access");
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);
  const entries = useAccessList(node);
  const can = usePermissions(node);
  const myRole = useEffectiveRole(node);

  const setAccessRule = usePermissionStore((state) => state.setAccessRule);
  const clearAccessRule = usePermissionStore((state) => state.clearAccessRule);
  const setPreviewRole = usePermissionStore((state) => state.setPreviewRole);
  const previewRole = usePermissionStore(selectPreviewRole);

  const parent = useMemo(() => {
    if (!node) return null;
    const path = findPathToId(tree, node.id);
    return path[path.length - 2] ?? null;
  }, [tree, node]);

  const previewOptions = useMemo<readonly ListboxOption[]>(
    () => [
      {
        value: SELF_VALUE,
        label: `My role (${ROLE_LABELS[myRole]})`,
        description: "The interface as you actually hold it.",
      },
      ...PREVIEW_ROLE_OPTIONS,
    ],
    [myRole],
  );

  const canManage = can("workspace.permission.manage");

  function grant(subject: AccessSubject, role: WorkspaceRole) {
    if (node) setAccessRule(workspace.id, node, subject, role);
  }

  function reset(subject: AccessSubject) {
    if (node) clearAccessRule(workspace.id, node, subject);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" className="flex max-h-[82vh] flex-col p-0">
        <DialogHeader size="sm" className="flex items-start gap-2.5 space-y-0">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-border bg-surface">
            <ShieldCheck className="size-4 text-accent" />
          </span>

          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lead">
              Access · {node?.name ?? workspace.name}
            </DialogTitle>
            <DialogDescription className="metric truncate text-body text-faint-foreground">
              {parent
                ? `Inherits from ${parent.name} unless a rule is written here`
                : "Top level — the workspace role is the floor under everything below"}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(next) => setTab(next as TabId)}
          className="min-h-0 flex-1"
        >
          <TabsList aria-label="Permission sections">
            {TABS.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <DialogBody size="sm">
            <TabsContent value="access">
              <AccessList
                entries={entries}
                canManage={canManage}
                onGrant={grant}
                onReset={reset}
              />

              {!canManage && (
                <p className="pt-3 text-ui text-muted-foreground">
                  You hold {ROLE_LABELS[myRole]} here, which can read this list but not change it.
                </p>
              )}
            </TabsContent>

            <TabsContent value="roles">
              <RoleMatrix highlight={previewRole ?? myRole} />
            </TabsContent>
          </DialogBody>
        </Tabs>

        <DialogFooter size="sm" align="start">
          <span id="role-preview-label" className="text-ui text-muted-foreground">
            Preview as
          </span>
          <Select
            size="sm"
            value={previewRole ?? SELF_VALUE}
            options={previewOptions}
            aria-labelledby="role-preview-label"
            onValueChange={(next) =>
              setPreviewRole(next === null || next === SELF_VALUE ? null : (next as WorkspaceRole))
            }
            className="w-48"
          />

          <p className="ml-auto max-w-sm text-right text-body text-faint-foreground">
            Preview only narrows what you see. The server re-checks every one of
            these on its own.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
