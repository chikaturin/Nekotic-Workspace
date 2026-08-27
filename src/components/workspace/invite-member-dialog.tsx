"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ROLE_LABELS } from "@/lib/permissions";
import { isWorkspaceMember } from "@/lib/workspace-access";
import { DIRECTORY } from "@/mock/users";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import {
  WORKSPACE_ROLES,
  type DirectoryUser,
  type UserSummary,
  type WorkspaceRole,
} from "@/types";

interface InviteMemberDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Adding somebody to the workspace.
 *
 * The directory is searched by name or address, and a match is added straight
 * away — this build has no invitation mailbox, and inventing one would mean
 * shipping a flow whose second half does not exist. An address that matches
 * nobody says so rather than silently creating an account.
 *
 * The search and the result list stay hand-built rather than becoming a
 * `Combobox`, and the reason is the paragraph at the bottom of this file. That
 * message is a function of what was typed — it only appears for something that
 * looks like an address, and it quotes the address back — whereas a Combobox
 * owns its query internally and offers the caller one static `emptyMessage`.
 * A picked row here also *performs* the invitation rather than setting a
 * value, which is not the shape `value`/`onValueChange` describes. Everything
 * that could move without losing that has: the field, the role select and the
 * rows are all primitives now.
 */
export function InviteMemberDialog({ isOpen, onClose }: InviteMemberDialogProps) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const addMember = useWorkspaceStore((state) => state.addMember);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");

  const needle = query.trim().toLowerCase();

  const candidates = DIRECTORY.filter(
    (person) =>
      person.isActive &&
      !isWorkspaceMember(workspace, person.id) &&
      (needle.length === 0 ||
        person.name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle)),
  );

  const looksLikeAddress = needle.includes("@");
  const isUnknownAddress = looksLikeAddress && candidates.length === 0;

  function invite(person: DirectoryUser) {
    // A member is a summary plus a role — `isActive` belongs to the directory
    // entry, not to the membership, so it is not carried across.
    const user: UserSummary = {
      id: person.id,
      name: person.name,
      email: person.email,
      initials: person.initials,
      ...(person.avatarUrl ? { avatarUrl: person.avatarUrl } : {}),
      ...(person.accentColor ? { accentColor: person.accentColor } : {}),
    };

    addMember(workspace.id, user, role);
    pushFeedback(`${person.name} joined as ${ROLE_LABELS[role]}`, "success");
    setQuery("");
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md" className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            People are added to {workspace.name} straight away. Their role decides what
            they can do; folder access is decided separately, on the folder.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="flex gap-2">
            <FormField label="Name or email" className="flex-1">
              {(field) => (
                <Input
                  {...field}
                  value={query}
                  autoFocus
                  placeholder="developer@nexdrop.vn"
                  onChange={(event) => setQuery(event.target.value)}
                />
              )}
            </FormField>

            {/* Stays the native select: four plain words, no icon, no second
                line, and it sits inside a dialog where a second portal buys
                nothing. The role picker in Members is the popover one because
                a table row has space for the descriptions and this row does
                not. */}
            <FormField label="Role" className="shrink-0">
              {(field) => (
                <SelectField
                  {...field}
                  value={role}
                  onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                >
                  {WORKSPACE_ROLES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {ROLE_LABELS[candidate]}
                    </option>
                  ))}
                </SelectField>
              )}
            </FormField>
          </div>

          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {candidates.map((person) => (
              <li key={person.id}>
                {/* A row is an action, not a selection — clicking it invites
                    the person — so it is a Button rather than a listbox row,
                    and it gains the focus ring the hand-rolled one never had.
                    The height is released because the row carries two lines. */}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => invite(person)}
                  className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left"
                >
                  <UserAvatar user={person} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui text-foreground">{person.name}</span>
                    <span className="block truncate text-body text-faint-foreground">
                      {person.email}
                    </span>
                  </span>
                  <UserPlus className="shrink-0 text-faint-foreground" />
                </Button>
              </li>
            ))}
          </ul>

          {isUnknownAddress && (
            <p className="rounded-md border border-hairline bg-surface px-2.5 py-2 text-body text-muted-foreground">
              Nobody in the directory uses <span className="text-foreground">{query.trim()}</span>.
              Sending an invitation to an address is not part of this build — the backend has no
              invitation flow yet, so adding them silently would be a lie.
            </p>
          )}

          {!isUnknownAddress && candidates.length === 0 && (
            <p className="text-body text-muted-foreground">
              Everybody in the directory is already a member.
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
