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
import { CURRENT_USER } from "@/mock/users";
import { isContainer, NODE_ACCESS_MODES, WORKSPACE_ROLES } from "@/types";
import type { DriveNode, NodeAccessMode, WorkspaceRole } from "@/types";

interface NodeAccessDialogProps {
  readonly node: DriveNode | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * The four roles, each carrying the sentence that says what it actually means.
 * A native <option> has nowhere to put that sentence, which is the whole reason
 * the per-person picker is no longer a native select: "Viewer" beside a name is
 * not an answer until you know a viewer changes nothing.
 */
const ROLE_OPTIONS: readonly ListboxOption[] = WORKSPACE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_SUMMARIES[role],
}));

/**
 * What picking one mode would do, said in full on the card itself.
 *
 * The inheriting card names the ancestor it currently follows, because "inherit
 * from parent" on its own does not tell you who that lets in — and who it lets
 * in is the question the dialog exists to answer.
 */
function describeMode(mode: NodeAccessMode, inheritedFrom: string | null): string {
  const summary = ACCESS_MODE_SUMMARIES[mode];
  if (mode !== "inherit" || inheritedFrom === null) return summary;
  return `${summary} Right now that is ${inheritedFrom}.`;
}

/**
 * How to talk about the thing being restricted.
 *
 * A folder gates its whole subtree and a file gates itself, and saying "and
 * everything inside it" over a CSV would describe a rule that does not exist.
 * The noun comes from the same visual table the icons do, so a Config document
 * is called a Config here too.
 */
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

/**
 * The empty state of the add box, which has to name what was searched for.
 *
 * `Combobox` owns its query and does not hand it back, so the query is read off
 * the command store the popover already runs on. Worth the reach: this sentence
 * is a product rule, not a "no results" shrug. Folder access is downstream of
 * workspace membership and never a way around it — somebody outside the
 * workspace has to be invited to it first, and silently pulling them in here
 * would make a folder dialog a membership control.
 */
function NoCandidateNotice() {
  const query = useCommandState((state) => state.search).trim();

  // Reached when everyone is already listed rather than when a search missed,
  // so the membership rule would be answering a question nobody asked.
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

/**
 * Who can see this item (SY-FAC).
 *
 * One choice and one list, in that order, because that is the order the
 * question is actually asked: *is this shut*, and if so, *who is in*. Anything
 * more — condition builders, effective-permission simulators, deny rules —
 * turns it into an IAM console, and access control that needs a manual is
 * access control nobody sets.
 *
 * The two layers stay visible and separate: the mode decides who gets *in*, the
 * role beside each name decides what they can do once they are. A viewer who is
 * listed sees the item and edits nothing; a manager who is not listed does not
 * see it at all.
 *
 * It opens on any node, a single file included. Restricting one file is the
 * case people actually reach for first — a credentials dump or an `.env` beside
 * a dozen harmless ones — and demanding a whole folder around it was making the
 * feature answer a question nobody asked.
 */
export function NodeAccessDialog({ node, isOpen, onClose }: NodeAccessDialogProps) {
  const access = useNodeAccess(node);
  const [pendingMode, setPendingMode] = useState<NodeAccessMode | null>(null);

  const mode = node ? accessModeOf(node) : "inherit";

  const candidateOptions = useMemo<readonly ListboxOption[]>(
    () =>
      access.candidates.map((person) => ({
        value: person.id,
        label: person.name,
        // The email is both the second line of the row and the second thing the
        // search scores against, which is exactly what the hand-rolled filter
        // this replaced did.
        description: person.email,
        // An empty string is Radix's own "there is no image" signal, and it is
        // what makes the circle fall through to initials. Without it a
        // directory where nobody has uploaded a photo — which is every row
        // today — draws no avatar at all, because a `ListboxOption` can only
        // express an avatar as a URL.
        avatarUrl: person.avatarUrl ?? "",
      })),
    [access.candidates],
  );

  if (!node) return null;

  const scope = accessScope(node);

  function changeMode(next: NodeAccessMode) {
    // Widening access is the change worth stopping to confirm: it is the one
    // that shows a folder to people who could not see it a moment ago.
    if (next === "workspace" && mode === "restricted") {
      setPendingMode(next);
      return;
    }
    access.setMode(next);
  }

  function addPerson(userId: string | null) {
    if (userId === null) return;

    // Somebody is added at the role they already hold in the workspace; the
    // select on their row is where it gets narrowed afterwards.
    const person = access.candidates.find((candidate) => candidate.id === userId);
    if (person) access.grant(person.id, person.role);
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
            {/* Three cards rather than a dropdown, because each option carries a
                consequence that has to be read *before* it is chosen — and a
                native <option> cannot hold a second line. */}
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
                            if (next !== null) access.grant(entry.user.id, next as WorkspaceRole);
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
                          onClick={() => access.revoke(entry.user.id)}
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
                    {/* Nothing is selected here and nothing stays selected: the
                        pick is an action, so the control reports the id, grants
                        it, and goes straight back to its placeholder. */}
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
          if (pendingMode) access.setMode(pendingMode);
          setPendingMode(null);
        }}
      />
    </>
  );
}

/** Re-exported so surfaces can name the actor without importing the mock. */
export const ACCESS_ACTOR_ID = CURRENT_USER.id;
