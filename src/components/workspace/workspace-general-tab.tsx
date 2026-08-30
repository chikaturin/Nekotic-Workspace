"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  badgeFor,
  validateWorkspaceName,
  WORKSPACE_DESCRIPTION_MAX,
  WORKSPACE_NAME_MAX,
} from "@/lib/workspace-access";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceGeneralTab({ canEdit }: { readonly canEdit: boolean }) {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

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
      <FormField label="Workspace name" error={error}>
        {(field) => (
          <Input
            {...field}
            value={name}
            disabled={!canEdit}
            maxLength={WORKSPACE_NAME_MAX}
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
            disabled={!canEdit}
            maxLength={WORKSPACE_DESCRIPTION_MAX}
            showCount
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </FormField>

      <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2">
        <span
          className="metric flex size-8 shrink-0 items-center justify-center rounded-md text-body font-bold"
          style={{
            backgroundColor: `color-mix(in oklch, ${workspace.color} 22%, transparent)`,
            color: workspace.color,
          }}
          aria-hidden
        >
          {badgeFor(name || workspace.name)}
        </span>
        <span className="text-body text-faint-foreground">
          Workspace tile. Taken from the name — there is no separate upload in this build.
        </span>
      </div>

      {canEdit ? (
        <Button type="submit" size="sm" disabled={!isDirty}>
          Save changes
        </Button>
      ) : (
        <p className="text-body text-faint-foreground">
          Only a workspace admin can change these.
        </p>
      )}
    </form>
  );
}
