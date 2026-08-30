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
import { useDirectory } from "@/hooks/use-directory";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import {
  WORKSPACE_ROLES,
  type DirectoryUser,
  type WorkspaceRole,
} from "@/types";

interface InviteMemberDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function InviteMemberDialog({ isOpen, onClose }: InviteMemberDialogProps) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const inviteMember = useWorkspaceStore((state) => state.inviteMember);
  const createMemberAccount = useWorkspaceStore((state) => state.createMemberAccount);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [query, setQuery] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const needle = query.trim().toLowerCase();
  const directory = useDirectory();

  const candidates = directory.filter(
    (person) =>
      person.isActive &&
      !isWorkspaceMember(workspace, person.id) &&
      (needle.length === 0 ||
        person.name.toLowerCase().includes(needle) ||
        person.email.toLowerCase().includes(needle)),
  );

  const looksLikeAddress = needle.includes("@");
  const isUnknownAddress = looksLikeAddress && candidates.length === 0;

  function close() {
    setQuery("");
    setName("");
    setPassword("");
    onClose();
  }

  async function invite(person: DirectoryUser) {
    setIsBusy(true);
    const sent = await inviteMember(person.email, role);
    setIsBusy(false);

    if (!sent) return;

    pushFeedback(
      `Invitation sent to ${person.name} — they join once they accept`,
      "success",
    );
    close();
  }

  async function createAccount() {
    const email = query.trim();
    const fullName = name.trim();

    setIsBusy(true);
    const created = await createMemberAccount({ email, name: fullName, password, role });
    setIsBusy(false);

    if (!created) return;

    pushFeedback(`${fullName} joined as ${ROLE_LABELS[role]}`, "success");
    close();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="md" className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            Somebody with an account is invited to {workspace.name} and joins when they
            accept. A new address gets an account created here and joins right away.
            Their role decides what they can do; folder access is decided separately,
            on the folder.
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
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => void invite(person)}
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
            <div className="space-y-2.5 rounded-md border border-hairline bg-surface p-2.5">
              <p className="text-body text-muted-foreground">
                Nobody uses <span className="text-foreground">{query.trim()}</span> yet.
                Create the account here and hand the password over — there is no
                invitation mailbox in this build, so a link sent to that address would
                reach nobody.
              </p>

              <div className="flex gap-2">
                <FormField label="Full name" className="flex-1">
                  {(field) => (
                    <Input
                      {...field}
                      value={name}
                      placeholder="Nguyễn Văn A"
                      onChange={(event) => setName(event.target.value)}
                    />
                  )}
                </FormField>

                <FormField label="Starting password" className="flex-1">
                  {(field) => (
                    <Input
                      {...field}
                      type="password"
                      value={password}
                      autoComplete="new-password"
                      placeholder="Ít nhất 8 ký tự"
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  )}
                </FormField>
              </div>

              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={isBusy || name.trim() === "" || password.length < 8}
                onClick={() => void createAccount()}
              >
                <UserPlus />
                Create account and add
              </Button>
            </div>
          )}

          {!isUnknownAddress && candidates.length === 0 && (
            <p className="text-body text-muted-foreground">
              Everybody in the directory is already a member.
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={close}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
