"use client";

import { LogOut, Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  canChangeRole,
  canLeaveWorkspace,
  canRemoveMember,
} from "@/lib/workspace-access";
import { formatDate } from "@/lib/format";
import { CURRENT_USER } from "@/mock/users";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import { WORKSPACE_ROLES, type WorkspaceMember, type WorkspaceRole } from "@/types";

/**
 * Who is in the workspace.
 *
 * Three actions that are deliberately *not* the same thing: inviting somebody,
 * removing somebody else, and walking out yourself. Collapsing them into one
 * control is how people end up removing themselves by accident, so each has its
 * own button, its own wording and its own refusal.
 *
 * The refusal that matters: the last admin can neither be removed, nor demoted,
 * nor leave. A workspace with nobody who can invite or promote cannot be
 * repaired from inside it.
 */
export function WorkspaceMembersTab() {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const setMemberRole = useWorkspaceStore((state) => state.setMemberRole);
  const removeMember = useWorkspaceStore((state) => state.removeMember);
  const leaveWorkspace = useWorkspaceStore((state) => state.leaveWorkspace);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const can = usePermissions();

  const [query, setQuery] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const canManage = can("workspace.member.manage");

  const members = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return workspace.members;

    return workspace.members.filter(
      (member) =>
        member.name.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle),
    );
  }, [workspace.members, query]);

  const leaveVerdict = canLeaveWorkspace(workspace, CURRENT_USER.id);

  function changeRole(member: WorkspaceMember, role: WorkspaceRole) {
    const verdict = canChangeRole(workspace, member.id, role);
    if (!verdict.isAllowed) {
      pushFeedback(verdict.reason ?? "That change is not allowed", "error");
      return;
    }

    setMemberRole(workspace.id, member.id, role);
    pushFeedback(`${member.name} is now ${ROLE_LABELS[role]}`, "success");
  }

  function confirmRemove(member: WorkspaceMember) {
    const verdict = canRemoveMember(workspace, CURRENT_USER.id, member.id);
    if (!verdict.isAllowed) {
      pushFeedback(verdict.reason ?? "That member cannot be removed", "error");
      return;
    }

    setRemoving(member);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint-foreground" />
          <Input
            value={query}
            placeholder="Search members"
            aria-label="Search members"
            onChange={(event) => setQuery(event.target.value)}
            className="pl-7"
          />
        </div>

        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setIsInviting(true)}>
            <UserPlus />
            Invite members
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[34rem] text-left text-[12px]">
          <thead className="bg-surface text-[11px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-hairline">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <UserAvatar user={member} className="size-6" />
                    <span className="truncate text-foreground">{member.name}</span>
                    {member.id === CURRENT_USER.id && (
                      <span className="text-[10px] text-faint-foreground">you</span>
                    )}
                  </span>
                </td>
                <td className="truncate px-3 py-2 text-muted-foreground">{member.email}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <SelectField
                      value={member.role}
                      aria-label={`Role for ${member.name}`}
                      onChange={(event) =>
                        changeRole(member, event.target.value as WorkspaceRole)
                      }
                    >
                      {WORKSPACE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </SelectField>
                  ) : (
                    <span className="text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-faint-foreground">{formatDate(member.joinedAt)}</td>
                <td className="px-3 py-2">
                  {canManage && member.id !== CURRENT_USER.id && (
                    <button
                      type="button"
                      aria-label={`Remove ${member.name}`}
                      title={`Remove ${member.name} from ${workspace.name}`}
                      onClick={() => confirmRemove(member)}
                      className="flex size-5 items-center justify-center rounded text-faint-foreground hover:bg-hover hover:text-danger"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p className="text-[12px] text-muted-foreground">Nobody matches “{query}”.</p>
      )}

      {/* Leaving is the member's own action, not an administrative one — so it
          sits apart from the table and never shares a control with Remove. */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {leaveVerdict.isAllowed
            ? `Leaving removes ${workspace.name} from your switcher.`
            : leaveVerdict.reason}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          disabled={!leaveVerdict.isAllowed}
          onClick={() => setIsLeaving(true)}
        >
          <LogOut />
          Leave workspace
        </Button>
      </div>

      <InviteMemberDialog isOpen={isInviting} onClose={() => setIsInviting(false)} />

      <ConfirmDialog
        isOpen={removing !== null}
        title={`Remove ${removing?.name ?? ""} from ${workspace.name}?`}
        description="They lose the workspace immediately, along with everything inside it. Their name still resolves on the records they touched."
        confirmLabel="Remove member"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            removeMember(workspace.id, removing.id);
            pushFeedback(`${removing.name} no longer has access`, "success");
          }
          setRemoving(null);
        }}
      />

      <ConfirmDialog
        isOpen={isLeaving}
        title={`Leave “${workspace.name}”?`}
        description="It disappears from your switcher, and you lose everything inside it. An admin can invite you back."
        confirmLabel="Leave workspace"
        onClose={() => setIsLeaving(false)}
        onConfirm={() => {
          setIsLeaving(false);
          leaveWorkspace(workspace.id, CURRENT_USER.id);
          pushFeedback(`You left ${workspace.name}`, "info");
        }}
      />
    </div>
  );
}
