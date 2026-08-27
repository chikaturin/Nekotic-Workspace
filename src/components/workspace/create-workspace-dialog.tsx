"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { DRIVE_ROOT_PATH } from "@/config/app";
import {
  badgeFor,
  validateWorkspaceName,
  WORKSPACE_DESCRIPTION_MAX,
  WORKSPACE_NAME_MAX,
} from "@/lib/workspace-access";
import { CURRENT_USER } from "@/mock/users";
import { useWorkspaceStore } from "@/store/workspace-store";

interface CreateWorkspaceDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Making a workspace.
 *
 * Two fields, because two is what it takes — a workspace with a name is a
 * workspace, and everything else is settings that can be changed later by
 * somebody who now has somewhere to change them from.
 *
 * The creator is an admin from the first frame, not from a second write: a
 * workspace that exists before anybody can administer it is a workspace that
 * can be stranded by a failure in between.
 */
export function CreateWorkspaceDialog({ isOpen, onClose }: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setName("");
    setDescription("");
    setError(null);
    onClose();
  }

  function submit() {
    const problem = validateWorkspaceName(name);
    if (problem) {
      setError(problem);
      return;
    }

    createWorkspace({ name, description }, CURRENT_USER);
    pushFeedback(`${name.trim()} is ready — you are its admin`, "success");
    close();
    router.push(DRIVE_ROOT_PATH);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="md" className="flex max-h-[85vh] flex-col">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            A workspace holds its own drive, its own people and its own permissions.
            Nothing is shared with the ones you are already in.
          </DialogDescription>
        </DialogHeader>

        {/* The form wraps the action row as well as the fields, because the
            submit button is in the footer: pressing Enter in the name field
            has always created the workspace, and a footer outside the form
            would quietly turn that into a no-op. */}
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogBody className="space-y-3">
            {/* The only thing that can fail validation is the name, so the
                refusal is rendered against that field rather than as a loose
                sentence at the bottom — which is also what puts the field
                itself into its invalid state. */}
            <FormField label="Workspace name" error={error} isRequired>
              {(field) => (
                <Input
                  {...field}
                  value={name}
                  autoFocus
                  maxLength={WORKSPACE_NAME_MAX}
                  placeholder="NexDrop Development"
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                />
              )}
            </FormField>

            <FormField label="Description">
              {(field) => (
                <Textarea
                  {...field}
                  value={description}
                  rows={3}
                  maxLength={WORKSPACE_DESCRIPTION_MAX}
                  showCount
                  placeholder="Development workspace for NexDrop products."
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </FormField>

            <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2">
              <span
                className="metric flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-body font-bold text-accent"
                aria-hidden
              >
                {badgeFor(name || "Workspace")}
              </span>
              <span className="text-body text-faint-foreground">
                The tile the switcher shows. Taken from the name.
              </span>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5">
              <Plus />
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
