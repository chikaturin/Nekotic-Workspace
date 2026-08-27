"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-w-md p-5">
        <DialogTitle className="text-[15px]">Invite members</DialogTitle>
        <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
          People are added to {workspace.name} straight away. Their role decides what
          they can do; folder access is decided separately, on the folder.
        </DialogDescription>

        <div className="mt-4 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Name or email
            </span>
            <Input
              value={query}
              autoFocus
              placeholder="developer@nexdrop.vn"
              aria-label="Find somebody to invite"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Role</span>
            <SelectField
              value={role}
              aria-label="Role for the new member"
              onChange={(event) => setRole(event.target.value as WorkspaceRole)}
              className="h-8"
            >
              {WORKSPACE_ROLES.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {ROLE_LABELS[candidate]}
                </option>
              ))}
            </SelectField>
          </label>
        </div>

        <ul className="mt-3 max-h-56 space-y-0.5 overflow-y-auto">
          {candidates.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => invite(person)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
              >
                <UserAvatar user={person} className="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-foreground">{person.name}</span>
                  <span className="block truncate text-[11px] text-faint-foreground">
                    {person.email}
                  </span>
                </span>
                <UserPlus className="size-3.5 shrink-0 text-faint-foreground" />
              </button>
            </li>
          ))}
        </ul>

        {isUnknownAddress && (
          <p className="mt-2 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[11px] text-muted-foreground">
            Nobody in the directory uses <span className="text-foreground">{query.trim()}</span>.
            Sending an invitation to an address is not part of this build — the backend has no
            invitation flow yet, so adding them silently would be a lie.
          </p>
        )}

        {!isUnknownAddress && candidates.length === 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Everybody in the directory is already a member.
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
