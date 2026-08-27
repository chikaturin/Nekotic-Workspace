"use client";

import { memo } from "react";
import { AttachmentCellView } from "@/components/board/cells/attachment-cell";
import { DateCellView } from "@/components/board/cells/date-cell";
import { LongTextCellView } from "@/components/board/cells/long-text-cell";
import { RelationCellView } from "@/components/board/cells/relation-cell";
import { SelectCellView } from "@/components/board/cells/select-cell";
import { TextCellView } from "@/components/board/cells/text-cell";
import { UserCellView } from "@/components/board/cells/user-cell";
import type { CellContext } from "@/lib/cell-values";
import type { BoardColumn, CellDisplayMode, CellValue } from "@/types";

interface CellRendererProps {
  readonly value: CellValue;
  readonly column: BoardColumn;
  readonly context: CellContext;
  /**
   * How much of the value this view shows. Only the text types can use it —
   * chips, dates and avatars are laid out rather than flowed, so a second line
   * would show nothing more of them.
   */
  readonly mode?: CellDisplayMode;
  /**
   * Lay the value out for this width rather than the column's. The detail
   * dialog is far wider than the cell the value came from, and reusing the
   * column's width there would wrap a paragraph as if it were still in a
   * 180px column.
   */
  readonly width?: number;
  /** True only where the surface delegates the reader — the grid. */
  readonly hasReader?: boolean;
}

const EMPTY_PEOPLE = new Map();
const EMPTY_LABELS = new Map<string, string>();

/**
 * Read-only projection of a cell. One renderer per type, dispatched on the
 * column — the value's own kind is checked so a schema change mid-flight can
 * never hand a date editor a text value.
 */
export const CellRenderer = memo(function CellRenderer({
  value,
  column,
  context,
  mode = "compact",
  width,
  hasReader = false,
}: CellRendererProps) {
  const laidOutAt = width ?? column.width;

  switch (column.type) {
    case "text":
      return value.kind === "text" ? (
        <TextCellView
          value={value}
          isPrimary={column.isPrimary}
          mode={mode}
          width={laidOutAt}
          hasReader={hasReader}
        />
      ) : null;

    case "longText":
      return value.kind === "longText" ? (
        <LongTextCellView
          value={value}
          mode={mode}
          width={laidOutAt}
          hasReader={hasReader}
        />
      ) : null;

    case "select":
      return value.kind === "select" ? <SelectCellView value={value} column={column} /> : null;

    case "date":
      return value.kind === "date" ? <DateCellView value={value} column={column} /> : null;

    case "user":
      return value.kind === "user" ? (
        <UserCellView value={value} people={context.people ?? EMPTY_PEOPLE} />
      ) : null;

    case "attachment":
      return value.kind === "attachment" ? <AttachmentCellView value={value} /> : null;

    case "relation":
      return value.kind === "relation" ? (
        <RelationCellView
          value={value}
          labels={context.relationLabels ?? EMPTY_LABELS}
          isResolved={context.relationResolved ?? false}
        />
      ) : null;
  }
});
