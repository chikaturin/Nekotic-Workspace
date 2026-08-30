"use client";

import { ListOrdered } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_STEP_NUMBERING, stepToken } from "@/lib/step-numbering";
import type { BoardColumnOf, StepNumbering } from "@/types";

interface StepNumberingDialogProps {
  readonly column: BoardColumnOf<"longText"> | null;
  readonly onClose: () => void;
  readonly onSave: (numbering: StepNumbering) => void;
}

const PREVIEW_STEPS = 3;

export function StepNumberingDialog({ column, onClose, onSave }: StepNumberingDialogProps) {
  const [edited, setEdited] = useState<{ columnId: string; draft: StepNumbering } | null>(null);

  const draft: StepNumbering | null =
    column === null
      ? null
      : edited?.columnId === column.id
        ? edited.draft
        : (column.config.stepNumbering ?? DEFAULT_STEP_NUMBERING);

  if (!column || !draft) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const patch = (changes: Partial<StepNumbering>) =>
    setEdited({ columnId: column.id, draft: { ...draft, ...changes } });

  const close = () => {
    setEdited(null);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="w-[30rem] max-w-[calc(100vw-2rem)] p-0">
        <header className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-title font-semibold text-foreground">
            <ListOrdered className="size-4 text-faint-foreground" />
            {column.name} step numbering
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-ui text-muted-foreground">
            With this on, an empty cell opens on its first step and Enter opens the next one.
            Shift+Enter still adds a plain line.
          </DialogDescription>
        </header>

        <div className="space-y-4 px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-ui text-foreground">
            <Checkbox
              checked={draft.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
            />
            Number the steps in this column
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-body text-muted-foreground">Prefix</span>
              <Input
                value={draft.prefix}
                disabled={!draft.enabled}
                maxLength={8}
                placeholder="none"
                aria-label="Step prefix"
                className="h-8 w-24 text-ui"
                onChange={(event) => patch({ prefix: event.target.value })}
              />
            </label>

            <label className="space-y-1">
              <span className="block text-body text-muted-foreground">Start at</span>
              <Input
                type="number"
                min={0}
                value={String(draft.start)}
                disabled={!draft.enabled}
                aria-label="First step number"
                className="h-8 w-24 text-ui"
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  patch({ start: Number.isFinite(parsed) ? Math.max(0, parsed) : 1 });
                }}
              />
            </label>

            <label className="space-y-1">
              <span className="block text-body text-muted-foreground">Separator</span>
              <Input
                value={draft.separator}
                disabled={!draft.enabled}
                maxLength={3}
                aria-label="Step separator"
                className="h-8 w-24 text-ui"
                onChange={(event) => patch({ separator: event.target.value })}
              />
            </label>
          </div>

          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-body text-faint-foreground">Result</p>
            <ul className="metric mt-1 space-y-0.5 text-ui text-foreground">
              {Array.from({ length: PREVIEW_STEPS }, (_, index) => (
                <li key={index}>{stepToken(draft, draft.start + index).trimEnd()}</li>
              ))}
            </ul>
          </div>

          <p className="text-body text-faint-foreground">
            Numbering only ever opens the next line. Nothing already written in a cell is renumbered
            unless you ask for it with Format steps.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              onSave(draft);
              close();
            }}
          >
            Save changes
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
