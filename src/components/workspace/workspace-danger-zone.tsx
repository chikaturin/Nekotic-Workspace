"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DRIVE_ROOT_PATH } from "@/config/app";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";

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
        <h3 className="text-lead font-semibold text-foreground">Delete this workspace</h3>
        <p className="mt-1 text-ui text-muted-foreground">
          Every folder, board, page and file in {workspace.name} goes with it, for everybody.
          This cannot be undone.
        </p>
      </div>

      <FormField
        label={
          <>
            Type <span className="text-foreground">{workspace.name}</span> to confirm
          </>
        }
      >
        {(field) => (
          <Input
            {...field}
            value={typed}
            placeholder={workspace.name}
            onChange={(event) => setTyped(event.target.value)}
          />
        )}
      </FormField>

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
