"use client";

import { Plus } from "lucide-react";
import { AttachmentGallery, AttachmentStrip } from "@/components/board/attachments/attachment-gallery";
import { CellShell, EditorSurface } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { useAttachmentField } from "@/hooks/use-attachment-field";
import type { BoardColumnOf, CellValue } from "@/types";

type AttachmentValue = Extract<CellValue, { kind: "attachment" }>;

/**
 * Ô đính kèm KHÔNG cho bôi đen chữ.
 *
 * Ô này mở bằng cú bấm đúp, mà bấm đúp cũng chính là lệnh bôi đen của trình
 * duyệt. Hai việc xảy ra cùng lúc: bảng đính kèm hiện ra, và cả nội dung của nó
 * — tên tệp, dung lượng, "Add files", "Close" — bị bôi xanh phía dưới.
 *
 * Ô chữ không dính vì nó thay ngay bằng một `<input>`. Ô này thì không, nên
 * phải nói thẳng với trình duyệt là ở đây không có gì để bôi.
 */
const NO_TEXT_SELECT = "select-none";

export function AttachmentCellView({ value }: { value: AttachmentValue }) {
  if (value.attachments.length === 0) {
    return (
      <CellShell className={NO_TEXT_SELECT}>
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
    <CellShell className={NO_TEXT_SELECT}>
      <AttachmentStrip files={value.attachments} isInteractive />
    </CellShell>
  );
}

interface AttachmentEditorProps {
  readonly column: BoardColumnOf<"attachment">;
  readonly rowId: string;
  readonly folderId: string | null;
  readonly focusId?: string | undefined;
  readonly onCancel: () => void;
}

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
