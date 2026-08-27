"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DRIVE_ROOT_PATH } from "@/config/app";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Deleting a workspace.
 *
 * Typing the name is not friction for its own sake: it is the one confirmation
 * that cannot be given by muscle memory, and this is the only action in the
 * product that takes a whole tenant with it.
 *
 * Deleting is not removing and not leaving. The other two are in Members,
 * where they belong, and none of the three shares a control with another.
 */
export function WorkspaceDangerZone({ onDeleted }: { readonly onDeleted: () => void }) {
  const router = useRouter();
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const deleteWorkspace = useWorkspaceStore((state) => state.deleteWorkspace);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [typed, setTyped] = useState("");
  const isConfirmed = typed.trim() === workspace.name;

  function destroy() {
    if (!isConfirmed) return;

    const { name } = workspace;
    deleteWorkspace(workspace.id);
    pushFeedback(`${name} was deleted`, "info");
    onDeleted();
    router.push(DRIVE_ROOT_PATH);
  }

  return (
    <div className="max-w-lg space-y-3 rounded-md border border-danger/40 bg-danger/5 p-4">
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">Delete this workspace</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Every folder, board, page and file in {workspace.name} goes with it, for everybody.
          This cannot be undone.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Type <span className="text-foreground">{workspace.name}</span> to confirm
        </span>
        <Input
          value={typed}
          aria-label="Type the workspace name to confirm"
          placeholder={workspace.name}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>

      <Button
        size="sm"
        variant="danger"
        className="gap-1.5"
        disabled={!isConfirmed}
        onClick={destroy}
      >
        <Trash2 />
        Delete workspace
      </Button>
    </div>
  );
}
