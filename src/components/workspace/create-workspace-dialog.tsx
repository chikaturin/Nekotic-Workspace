"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
      <DialogContent className="max-w-md p-5">
        <DialogTitle className="text-title">Create workspace</DialogTitle>
        <DialogDescription className="mt-1 text-ui text-muted-foreground">
          A workspace holds its own drive, its own people and its own permissions.
          Nothing is shared with the ones you are already in.
        </DialogDescription>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-body font-medium text-muted-foreground">
              Workspace name <span className="text-danger">*</span>
            </span>
            <Input
              value={name}
              autoFocus
              maxLength={WORKSPACE_NAME_MAX}
              placeholder="NexDrop Development"
              aria-label="Workspace name"
              aria-invalid={error !== null}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-body font-medium text-muted-foreground">
              Description
            </span>
            <textarea
              value={description}
              rows={3}
              maxLength={WORKSPACE_DESCRIPTION_MAX}
              placeholder="Development workspace for NexDrop products."
              aria-label="Workspace description"
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-ui text-foreground outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

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

          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5">
              <Plus />
              Create workspace
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
