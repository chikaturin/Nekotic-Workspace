"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  badgeFor,
  validateWorkspaceName,
  WORKSPACE_DESCRIPTION_MAX,
  WORKSPACE_NAME_MAX,
} from "@/lib/workspace-access";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Name, description and tile.
 *
 * Read-only for anybody without `workspace.manage`: the fields still render,
 * because knowing what the workspace is called is not a privilege — only
 * changing it is.
 */
export function WorkspaceGeneralTab({ canEdit }: { readonly canEdit: boolean }) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  /**
   * The draft is keyed by what it was taken from.
   *
   * Switching workspaces behind an open dialog would otherwise leave the other
   * workspace's name sitting in the form, one Save away from being applied to
   * this one. Keying the draft rather than resetting it in an effect means the
   * stale value is never rendered at all, not even for a frame.
   */
  const stored = `${workspace.id}:${workspace.name}:${workspace.description ?? ""}`;
  const [draft, setDraft] = useState({ stored, name: workspace.name, description: workspace.description ?? "" });
  const [error, setError] = useState<string | null>(null);

  const current =
    draft.stored === stored
      ? draft
      : { stored, name: workspace.name, description: workspace.description ?? "" };

  const { name, description } = current;
  const setName = (value: string) => setDraft({ ...current, name: value });
  const setDescription = (value: string) => setDraft({ ...current, description: value });

  const isDirty = name !== workspace.name || description !== (workspace.description ?? "");

  function save() {
    const problem = validateWorkspaceName(name);
    if (problem) {
      setError(problem);
      return;
    }

    updateWorkspace(workspace.id, { name, description });
    pushFeedback("Workspace updated", "success");
  }

  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Workspace name
        </span>
        <Input
          value={name}
          disabled={!canEdit}
          maxLength={WORKSPACE_NAME_MAX}
          aria-label="Workspace name"
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
          Description
        </span>
        <textarea
          value={description}
          rows={3}
          disabled={!canEdit}
          maxLength={WORKSPACE_DESCRIPTION_MAX}
          aria-label="Workspace description"
          onChange={(event) => setDescription(event.target.value)}
          className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-foreground outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
      </label>

      <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2">
        <span
          className="metric flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
          style={{
            backgroundColor: `color-mix(in oklch, ${workspace.color} 22%, transparent)`,
            color: workspace.color,
          }}
          aria-hidden
        >
          {badgeFor(name || workspace.name)}
        </span>
        <span className="text-[11px] text-faint-foreground">
          Workspace tile. Taken from the name — there is no separate upload in this build.
        </span>
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}

      {canEdit ? (
        <Button type="submit" size="sm" disabled={!isDirty}>
          Save changes
        </Button>
      ) : (
        <p className="text-[11px] text-faint-foreground">
          Only a workspace admin can change these.
        </p>
      )}
    </form>
  );
}
