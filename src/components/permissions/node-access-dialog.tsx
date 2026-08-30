"use client";

import { useCommandState } from "cmdk";
import { Lock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import type { ListboxOption } from "@/components/ui/listbox";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { useNodeAccess } from "@/hooks/use-node-access";
import { ROLE_LABELS, ROLE_SUMMARIES } from "@/lib/permissions";
import {
  ACCESS_MODE_LABELS,
  ACCESS_MODE_SUMMARIES,
  accessModeOf,
} from "@/lib/permissions/visibility";
import { nodeVisual } from "@/lib/node-visuals";
import { isContainer, NODE_ACCESS_MODES, WORKSPACE_ROLES } from "@/types";
import type { DriveNode, NodeAccessMode, WorkspaceRole } from "@/types";

interface NodeAccessDialogProps {
  readonly node: DriveNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const ROLE_OPTIONS: readonly ListboxOption[] = WORKSPACE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_SUMMARIES[role],
}));

function describeMode(mode: NodeAccessMode, inheritedFrom: string | null): string {
  const summary = ACCESS_MODE_SUMMARIES[mode];
  if (mode !== "inherit" || inheritedFrom === null) return summary;
  return `${summary} Right now that is ${inheritedFrom}.`;
}

function accessScope(node: DriveNode): {
  readonly noun: string;
  readonly subject: string;
  readonly everything: string;
} {
  const noun = nodeVisual(node).label.toLowerCase();
  const subject = `this ${noun}`;

  return {
    noun,
    subject,
    everything: isContainer(node) ? `${subject} and everything inside it` : subject,
  };
}

function NoCandidateNotice() {
  const query = useCommandState((state) => state.search).trim();

  if (query.length === 0) {
    return <>Everyone in this workspace already has access to this item.</>;
  }

  return (
    <>
      Nobody matching “{query}” is a member of this workspace. Invite them in Workspace
      settings first.
    </>
  );
}

export function NodeAccessDialog({ node, isOpen, onClose }: NodeAccessDialogProps) {
  const access = useNodeAccess(node);
  const [pendingMode, setPendingMode] = useState<NodeAccessMode | null>(null);

  const mode = node ? accessModeOf(node) : "inherit";

  const candidateOptions = useMemo<readonly ListboxOption[]>(
    () =>
      access.candidates.map((person) => ({
        value: person.id,
        label: person.name,
        description: person.email,
        avatarUrl: person.avatarUrl ?? "",
      })),
    [access.candidates],
  );

  if (!node) return null;

  const scope = accessScope(node);

  function changeMode(next: NodeAccessMode) {
    if (next === "workspace" && mode === "restricted") {
      setPendingMode(next);
      return;
    }
    void access.setMode(next);
  }

  function addPerson(userId: string | null) {
    if (userId === null) return;

    const person = access.candidates.find((candidate) => candidate.id === userId);
    if (person) void access.grant(person.id, person.role);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="md" className="flex max-h-[80vh] flex-col p-0">
          <DialogHeader size="sm">
            <DialogTitle className="flex items-center gap-1.5">
              {mode === "restricted" && <Lock className="size-3.5 text-faint-foreground" />}
              {node.name}
            </DialogTitle>
            <DialogDescription>Who can see {scope.everything}.</DialogDescription>
          </DialogHeader>

          <DialogBody size="sm" className="space-y-4">
            <RadioGroup
              label="Access"
              value={mode}
              disabled={!access.canManage}
              onValueChange={(next) => changeMode(next as NodeAccessMode)}
              listClassName="gap-1.5"
            >
              {NODE_ACCESS_MODES.map((candidate) => (
                <RadioCard
                  key={candidate}
                  value={candidate}
                  label={ACCESS_MODE_LABELS[candidate]}
                  description={describeMode(candidate, access.inheritedFrom)}
                />
              ))}
            </RadioGroup>

            {mode === "restricted" ? (
              <div>
                <p className="mb-1.5 text-body font-medium text-muted-foreground">
                  People with access
                </p>

                <ul className="space-y-0.5">
                  {access.granted.map((entry) => (
                    <li
                      key={entry.user.id}
                      className="flex items-center gap-2 rounded-md px-1 py-1"
                    >
                      <UserAvatar user={entry.user} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ui text-foreground">
                          {entry.user.name}
                          {entry.isOwner && (
                            <span className="ml-1 text-micro text-faint-foreground">owner</span>
                          )}
                        </span>
                        <span className="block truncate text-body text-faint-foreground">
                          {entry.user.email}
                        </span>
                      </span>

                      {access.canManage && !entry.isOwner ? (
                        <Select
                          size="sm"
                          value={entry.role}
                          options={ROLE_OPTIONS}
                          aria-label={`What ${entry.user.name} can do here`}
                          onValueChange={(next) => {
                            if (next !== null) void access.grant(entry.user.id, next as WorkspaceRole);
                          }}
                          className="w-32 shrink-0"
                        />
                      ) : (
                        <Badge variant="neutral">{ROLE_LABELS[entry.role]}</Badge>
                      )}

                      {access.canManage && !entry.isOwner && (
                        <IconButton
                          variant="ghost"
                          aria-label={`Remove ${entry.user.name}`}
                          tooltip={`Remove from ${scope.noun}`}
                          onClick={() => void access.revoke(entry.user.id)}
                          className="shrink-0 text-faint-foreground hover:text-danger"
                        >
                          <X />
                        </IconButton>
                      )}
                    </li>
                  ))}
                </ul>

                {access.canManage && (
                  <div className="mt-3 border-t border-hairline pt-3">
                    <p className="mb-1.5 text-body font-medium text-muted-foreground">
                      Add people
                    </p>
                    <Combobox
                      size="sm"
                      value={null}
                      options={candidateOptions}
                      placeholder="Search workspace members"
                      searchPlaceholder="Search workspace members"
                      aria-label="Search workspace members"
                      emptyMessage={<NoCandidateNotice />}
                      onValueChange={addPerson}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-hairline bg-surface px-3 py-2 text-body text-muted-foreground">
                {mode === "workspace"
                  ? `Every member of the workspace can see ${scope.everything} — as long as they can reach the folder it sits in. All-members widens from here down; it cannot reopen a restriction set above.`
                  : `${scope.subject} is shown to whoever can see the folder it sits in. Switch to Restricted to choose people yourself.`}
              </p>
            )}

            {!access.canManage && (
              <p className="text-body text-faint-foreground">
                You can see who has access, but not change it.
              </p>
            )}
          </DialogBody>

          <DialogFooter size="sm">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={pendingMode !== null}
        isDestructive={false}
        title={`Make “${node.name}” visible to everyone?`}
        description={`Every member of the workspace will be able to see ${scope.everything}. The people listed here keep the roles they were given.`}
        confirmLabel="Make accessible"
        onClose={() => setPendingMode(null)}
        onConfirm={() => {
          if (pendingMode) void access.setMode(pendingMode);
          setPendingMode(null);
        }}
      />
    </>
  );
}
