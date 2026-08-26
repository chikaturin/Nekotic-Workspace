"use client";

import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AccessList } from "@/components/permissions/access-list";
import { RoleMatrix } from "@/components/permissions/role-matrix";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { useAccessList, useEffectiveRole, usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { findPathToId } from "@/lib/tree";
import { cn } from "@/lib/utils";
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

interface PermissionDialogProps {
  readonly node: DriveNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Access on one item (SY-INH-43) beside the matrix it is drawn from
 * (SY-RBC-42).
 *
 * The two tabs answer different questions — "who can open this" and "what does
 * that role actually allow" — and both read the one catalogue, so the table on
 * screen cannot fall out of step with the app around it.
 */
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

  const canManage = can("workspace.permission.manage");

  function grant(subject: AccessSubject, role: WorkspaceRole) {
    if (node) setAccessRule(workspace.id, node, subject, role);
  }

  function reset(subject: AccessSubject) {
    if (node) clearAccessRule(workspace.id, node, subject);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[82vh] w-full max-w-2xl flex-col p-0">
        <header className="flex shrink-0 items-start gap-2.5 border-b border-border px-4 py-3">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-border bg-surface">
            <ShieldCheck className="size-4 text-accent" />
          </span>

          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-semibold text-foreground">
              Access · {node?.name ?? workspace.name}
            </DialogTitle>
            <DialogDescription className="metric truncate text-[11px] text-faint-foreground">
              {parent
                ? `Inherits from ${parent.name} unless a rule is written here`
                : "Top level — the workspace role is the floor under everything below"}
            </DialogDescription>
          </div>
        </header>

        <div role="tablist" aria-label="Permission sections" className="flex shrink-0 gap-0.5 border-b border-border px-3">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`permission-tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls={`permission-panel-${entry.id}`}
              onClick={() => setTab(entry.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[12px] transition-colors",
                tab === entry.id
                  ? "border-accent font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <section
            role="tabpanel"
            id="permission-panel-access"
            aria-labelledby="permission-tab-access"
            hidden={tab !== "access"}
          >
            <AccessList
              entries={entries}
              canManage={canManage}
              onGrant={grant}
              onReset={reset}
            />

            {!canManage && (
              <p className="pt-3 text-[12px] text-muted-foreground">
                You hold {ROLE_LABELS[myRole]} here, which can read this list but not change it.
              </p>
            )}
          </section>

          <section
            role="tabpanel"
            id="permission-panel-roles"
            aria-labelledby="permission-tab-roles"
            hidden={tab !== "roles"}
          >
            <RoleMatrix highlight={previewRole ?? myRole} />
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
          <label htmlFor="role-preview" className="text-[12px] text-muted-foreground">
            Preview as
          </label>
          <SelectField
            id="role-preview"
            value={previewRole ?? "self"}
            onChange={(event) =>
              setPreviewRole(event.target.value === "self" ? null : (event.target.value as WorkspaceRole))
            }
          >
            <option value="self">My role ({ROLE_LABELS[myRole]})</option>
            {WORKSPACE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </SelectField>

          {/* Said here rather than in a doc nobody opens: this whole dialog is
              about what the interface offers, not about what is enforced. */}
          <p className="ml-auto max-w-sm text-right text-[11px] text-faint-foreground">
            Preview only narrows what you see. The server re-checks every one of
            these on its own.
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
