"use client";

import { Lock, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { useFolderAccess } from "@/hooks/use-folder-access";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  ACCESS_MODE_LABELS,
  ACCESS_MODE_SUMMARIES,
  accessModeOf,
} from "@/lib/permissions/visibility";
import { CURRENT_USER } from "@/mock/users";
import { NODE_ACCESS_MODES, WORKSPACE_ROLES } from "@/types";
import type { DriveNode, NodeAccessMode, WorkspaceRole } from "@/types";

interface FolderAccessDialogProps {
  readonly node: DriveNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Who can see this folder (SY-FAC).
 *
 * One dropdown and one list, in that order, because that is the order the
 * question is actually asked: *is this folder shut*, and if so, *who is in*.
 * Anything more — condition builders, effective-permission simulators, deny
 * rules — turns a folder into an IAM console, and a folder that needs a manual
 * is a folder nobody restricts.
 *
 * The two layers stay visible and separate: the mode decides who gets *in*, the
 * role beside each name decides what they can do once they are. A viewer who is
 * listed sees the folder and edits nothing; a manager who is not listed does
 * not see it at all.
 */
export function FolderAccessDialog({ node, isOpen, onClose }: FolderAccessDialogProps) {
  const access = useFolderAccess(node);
  const [query, setQuery] = useState("");
  const [pendingMode, setPendingMode] = useState<NodeAccessMode | null>(null);

  const mode = node ? accessModeOf(node) : "inherit";

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return access.candidates.filter(
      (person) =>
        needle.length === 0 ||
        person.name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle),
    );
  }, [access.candidates, query]);

  if (!node) return null;

  function changeMode(next: NodeAccessMode) {
    // Widening access is the change worth stopping to confirm: it is the one
    // that shows a folder to people who could not see it a moment ago.
    if (next === "workspace" && mode === "restricted") {
      setPendingMode(next);
      return;
    }
    access.setMode(next);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[80vh] w-[min(30rem,92vw)] max-w-none flex-col p-5">
          <DialogTitle className="flex items-center gap-1.5 text-[15px]">
            {mode === "restricted" && <Lock className="size-3.5 text-faint-foreground" />}
            {node.name}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
            Who can see this folder and everything inside it.
          </DialogDescription>

          <label className="mt-4 block">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Access
            </span>
            <SelectField
              value={mode}
              disabled={!access.canManage}
              aria-label="Folder access"
              onChange={(event) => changeMode(event.target.value as NodeAccessMode)}
              className="h-8 w-full"
            >
              {NODE_ACCESS_MODES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {ACCESS_MODE_LABELS[candidate]}
                </option>
              ))}
            </SelectField>
            <span className="mt-1 block text-[11px] text-faint-foreground">
              {ACCESS_MODE_SUMMARIES[mode]}
              {mode === "inherit" && access.inheritedFrom
                ? ` Right now that is ${access.inheritedFrom}.`
                : ""}
            </span>
          </label>

          {mode === "restricted" ? (
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                People with access
              </p>

              <ul className="space-y-0.5">
                {access.granted.map((entry) => (
                  <li key={entry.user.id} className="flex items-center gap-2 rounded-md px-1 py-1">
                    <UserAvatar user={entry.user} className="size-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-foreground">
                        {entry.user.name}
                        {entry.isOwner && (
                          <span className="ml-1 text-[10px] text-faint-foreground">owner</span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-faint-foreground">
                        {entry.user.email}
                      </span>
                    </span>

                    {access.canManage && !entry.isOwner ? (
                      <SelectField
                        value={entry.role}
                        aria-label={`What ${entry.user.name} can do here`}
                        onChange={(event) =>
                          access.grant(entry.user.id, event.target.value as WorkspaceRole)
                        }
                      >
                        {WORKSPACE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </SelectField>
                    ) : (
                      <Badge variant="default">{ROLE_LABELS[entry.role]}</Badge>
                    )}

                    {access.canManage && !entry.isOwner && (
                      <button
                        type="button"
                        aria-label={`Remove ${entry.user.name}`}
                        onClick={() => access.revoke(entry.user.id)}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-danger"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {access.canManage && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                    Add people
                  </p>
                  <Input
                    value={query}
                    placeholder="Search workspace members"
                    aria-label="Search workspace members"
                    onChange={(event) => setQuery(event.target.value)}
                  />

                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                    {candidates.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => {
                            access.grant(person.id, person.role);
                            setQuery("");
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-hover"
                        >
                          <UserAvatar user={person} className="size-6" />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                            {person.name}
                          </span>
                          <Plus className="size-3.5 shrink-0 text-faint-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Folder access is downstream of workspace membership, never
                      a way around it. Somebody outside the workspace has to be
                      invited to it first — silently pulling them in here would
                      make a folder dialog a membership control. */}
                  {candidates.length === 0 && query.trim().length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Nobody matching “{query.trim()}” is a member of this workspace. Invite
                      them in Workspace settings first.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-hairline bg-surface px-3 py-2 text-[11px] text-muted-foreground">
              {mode === "workspace"
                ? "Every member of the workspace can see this folder — as long as they can reach the folder it sits in. All-members widens from here down; it cannot reopen a restriction set above."
                : "This folder shows whoever can see the folder it sits in. Switch to Restricted to choose people yourself."}
            </p>
          )}

          {!access.canManage && (
            <p className="mt-3 text-[11px] text-faint-foreground">
              You can see who has access, but not change it.
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={pendingMode !== null}
        isDestructive={false}
        title={`Make “${node.name}” visible to everyone?`}
        description={`Every member of the workspace will be able to see ${node.name} and everything inside it. The people listed here keep the roles they were given.`}
        confirmLabel="Make accessible"
        onClose={() => setPendingMode(null)}
        onConfirm={() => {
          if (pendingMode) access.setMode(pendingMode);
          setPendingMode(null);
        }}
      />
    </>
  );
}

/** Re-exported so surfaces can name the actor without importing the mock. */
export const ACCESS_ACTOR_ID = CURRENT_USER.id;
