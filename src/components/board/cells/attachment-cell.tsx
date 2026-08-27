"use client";

import { Plus } from "lucide-react";
import { AttachmentGallery, AttachmentStrip } from "@/components/board/attachments/attachment-gallery";
import { CellShell, EditorSurface } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { useAttachmentField } from "@/hooks/use-attachment-field";
import type { BoardColumnOf, CellValue } from "@/types";

type AttachmentValue = Extract<CellValue, { kind: "attachment" }>;

/**
 * An attachment cell, read-only.
 *
 * Empty, it offers the only thing it can do. The hint stays invisible until
 * the pointer is over the cell, so a column of empty cells reads as empty
 * rather than as a column of buttons — but the click target is the whole cell,
 * not the hint, so nobody has to aim at it. `GridCell` is what turns that click
 * into the uploader; the marker here is what tells it to.
 *
 * With files in it the cell shows them, and a click on one opens *that* file —
 * the editor is handed its id and opens on its preview. Reaching for a file
 * and being given an upload dialog is the wrong answer to the question the
 * click asked.
 */
export function AttachmentCellView({ value }: { value: AttachmentValue }) {
  if (value.attachments.length === 0) {
    return (
      <CellShell>
        <span
          data-cell-expand=""
          title="Add attachment"
          className="flex items-center gap-1 text-micro text-faint-foreground opacity-0 transition-opacity group-hover/cell:opacity-100"
        >
          <Plus className="size-3" />
          Add file
        </span>
      </CellShell>
    );
  }

  return (
    <CellShell>
      <AttachmentStrip files={value.attachments} isInteractive />
    </CellShell>
  );
}

interface AttachmentEditorProps {
  readonly column: BoardColumnOf<"attachment">;
  readonly rowId: string;
  readonly folderId: string | null;
  /** Attachment the cell was opened on, if a particular file was clicked. */
  readonly focusId?: string | undefined;
  readonly onCancel: () => void;
}

/**
 * Attachment editing in the grid.
 *
 * There is no local draft here: the editor writes straight to the record's
 * attachment cell through `useAttachmentField`, which is the same field the
 * drawer's Attachments section reads. Dropping a screenshot in the cell is
 * therefore visible in the drawer immediately, and vice versa, because both
 * are looking at one value rather than two copies of it.
 *
 * That is also why the popover has a Close and not a Save: every upload and
 * every removal has already been committed to the board record — and why
 * clicking away closes it rather than asking. There is nothing to lose.
 */
export function AttachmentCellEditor({
  column,
  rowId,
  folderId,
  focusId,
  onCancel,
}: AttachmentEditorProps) {
  const field = useAttachmentField(rowId, column.id, column.config.maxFiles, folderId);

  return (
    <EditorSurface className="w-72" onDismiss={onCancel}>
      <AttachmentGallery
        field={field}
        maxFiles={column.config.maxFiles}
        canEdit
        density="compact"
        label={column.name}
        initialOpenId={focusId ?? null}
      />

      <div className="flex justify-end border-t border-border p-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2 text-body">
          Close
        </Button>
      </div>
    </EditorSurface>
  );
}
