"use client";

import { AttachmentGallery, AttachmentStrip } from "@/components/board/attachments/attachment-gallery";
import { CellShell, EditorSurface } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { useAttachmentField } from "@/hooks/use-attachment-field";
import type { BoardColumnOf, CellValue } from "@/types";

type AttachmentValue = Extract<CellValue, { kind: "attachment" }>;

export function AttachmentCellView({ value }: { value: AttachmentValue }) {
  return (
    <CellShell>
      <AttachmentStrip files={value.attachments} />
    </CellShell>
  );
}

interface AttachmentEditorProps {
  readonly column: BoardColumnOf<"attachment">;
  readonly rowId: string;
  readonly folderId: string | null;
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
 * every removal has already been committed to the board record.
 */
export function AttachmentCellEditor({
  column,
  rowId,
  folderId,
  onCancel,
}: AttachmentEditorProps) {
  const field = useAttachmentField(rowId, column.id, column.config.maxFiles, folderId);

  return (
    <EditorSurface className="w-72">
      <AttachmentGallery
        field={field}
        maxFiles={column.config.maxFiles}
        canEdit
        density="compact"
        label={column.name}
      />

      <div className="flex justify-end border-t border-border p-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2 text-[11px]">
          Close
        </Button>
      </div>
    </EditorSurface>
  );
}
