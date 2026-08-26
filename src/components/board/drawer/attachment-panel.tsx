"use client";

import { Paperclip } from "lucide-react";
import { AttachmentGallery } from "@/components/board/attachments/attachment-gallery";
import { Badge } from "@/components/ui/badge";
import { useAttachmentField } from "@/hooks/use-attachment-field";
import { attachmentColumns } from "@/lib/attachments";
import type { BoardColumn, BoardColumnOf } from "@/types";

interface AttachmentPanelProps {
  readonly rowId: string;
  readonly columns: readonly BoardColumn[];
  readonly folderId: string | null;
  readonly canEdit: boolean;
}

/**
 * Attachments on a record, in the drawer.
 *
 * Reads exactly the same cells the table's attachment column shows — one
 * section per attachment column the board declares. There is no
 * `drawerAttachments`: uploading here writes the record, so the table's cell
 * updates on the next frame, and an upload started in the cell shows up here
 * mid-flight with its progress intact.
 */
export function AttachmentPanel({ rowId, columns, folderId, canEdit }: AttachmentPanelProps) {
  const fields = attachmentColumns(columns) as readonly BoardColumnOf<"attachment">[];
  if (fields.length === 0) return null;

  return (
    <section aria-label="Attachments" className="space-y-3">
      <header className="flex items-center gap-2">
        <Paperclip className="size-3.5 shrink-0 text-faint-foreground" />
        <h3 className="text-[12px] font-medium text-foreground">Attachments</h3>
      </header>

      {fields.map((column) => (
        <AttachmentColumnSection
          key={column.id}
          column={column}
          rowId={rowId}
          folderId={folderId}
          canEdit={canEdit}
          showName={fields.length > 1}
        />
      ))}
    </section>
  );
}

interface SectionProps {
  readonly column: BoardColumnOf<"attachment">;
  readonly rowId: string;
  readonly folderId: string | null;
  readonly canEdit: boolean;
  /** Only worth naming the column when the board has more than one. */
  readonly showName: boolean;
}

function AttachmentColumnSection({ column, rowId, folderId, canEdit, showName }: SectionProps) {
  const field = useAttachmentField(rowId, column.id, column.config.maxFiles, folderId);

  return (
    <div className="space-y-1.5">
      {showName && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{column.name}</span>
          {field.files.length > 0 && <Badge variant="default">{field.files.length}</Badge>}
        </div>
      )}

      {field.files.length === 0 && !canEdit ? (
        <p className="text-[12px] text-faint-foreground">Nothing attached.</p>
      ) : (
        <AttachmentGallery
          field={field}
          maxFiles={column.config.maxFiles}
          canEdit={canEdit}
          label={column.name}
        />
      )}
    </div>
  );
}
