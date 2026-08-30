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
  readonly mode?: CellDisplayMode;
  readonly width?: number;
  readonly hasReader?: boolean;
}

const EMPTY_PEOPLE = new Map();
const EMPTY_LABELS = new Map<string, string>();

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
