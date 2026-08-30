"use client";

import { Maximize2 } from "lucide-react";
import { useId, useState } from "react";
import { CellDetailDialog } from "@/components/board/cells/cell-detail-dialog";
import { CellEditor } from "@/components/board/cells/cell-editor";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { estimateLines, isFlexibleColumn, WRAP_MAX_LINES } from "@/lib/cell-display";
import { cellText } from "@/lib/cell-values";
import { Label } from "@/components/ui/field";
import { columnVisual } from "@/lib/board-visuals";
import type { CellContext } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import type { BoardColumn, CellValue, DirectoryUser, SelectOption } from "@/types";

interface DrawerFieldProps {
  readonly column: BoardColumn;
  readonly value: CellValue;
  readonly context: CellContext;
  readonly rowId: string;
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  readonly columns: readonly BoardColumn[];
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
  readonly onCommit: (value: CellValue) => void;
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
  readonly recordLabel?: string;
  readonly isFrozen?: boolean;
  readonly canEdit?: boolean;
}

export function DrawerField({
  column,
  value,
  context,
  rowId,
  boardId,
  primaryColumnId,
  folderId,
  people,
  columns,
  isEditing,
  onEditingChange,
  onCommit,
  onCreateOption,
  recordLabel,
  isFrozen = false,
  canEdit = true,
}: DrawerFieldProps) {
  const visual = columnVisual(column.type);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const valueId = `${fieldId}-value`;

  const [isReading, setIsReading] = useState(false);

  const isWrapped = isFlexibleColumn(column);

  const mode: "full" | "wrap" | "compact" = isWrapped ? (isFrozen ? "full" : "wrap") : "compact";
  const hasMore =
    isWrapped &&
    !isFrozen &&
    estimateLines(cellText(value, column, context), DRAWER_FIELD_WIDTH, "full") > WRAP_MAX_LINES;

  return (
    <div
      data-drawer-field={column.id}
      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3 py-1.5"
    >
      <Label id={labelId} className="mb-0 flex min-w-0 items-center gap-1.5 pt-1.5">
        <visual.Icon className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="truncate">{column.name}</span>
      </Label>

      <div className="group/field relative min-w-0">
        {isEditing ? (
          <CellEditor
            value={value}
            column={column}
            rowId={rowId}
            boardId={boardId}
            primaryColumnId={primaryColumnId}
            folderId={folderId}
            people={people}
            columns={columns}
            context={context}
            onCommit={(next) => {
              onCommit(next);
              onEditingChange(false);
            }}
            onCancel={() => onEditingChange(false)}
            onCreateOption={onCreateOption}
          />
        ) : (
          <button
            type="button"
            id={valueId}
            aria-labelledby={`${labelId} ${valueId}`}
            disabled={!canEdit}
            onClick={() => onEditingChange(true)}
            className={cn(
              "flex min-h-[var(--control-md)] w-full items-center rounded-md text-left",
              "border border-transparent outline-none transition-colors",
              canEdit && "hover:border-border hover:bg-hover",
              "focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <CellRenderer
              value={value}
              column={column}
              context={context}
              mode={mode}
              width={DRAWER_FIELD_WIDTH}
            />
          </button>
        )}

        {!isEditing && hasMore && (
          <button
            type="button"
            aria-label={`Read all of ${column.name}`}
            title="Read the whole value"
            onClick={() => setIsReading(true)}
            className="absolute right-1 top-1 rounded bg-elevated p-1 text-faint-foreground opacity-0 shadow-raise transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/field:opacity-100"
          >
            <Maximize2 className="size-3" />
          </button>
        )}
      </div>

      <CellDetailDialog
        column={isReading ? column : null}
        value={isReading ? value : null}
        context={context}
        {...(recordLabel ? { recordLabel } : {})}
        onClose={() => setIsReading(false)}
        onEdit={
          canEdit
            ? () => {
                setIsReading(false);
                onEditingChange(true);
              }
            : undefined
        }
      />
    </div>
  );
}

const DRAWER_FIELD_WIDTH = 360;
