"use client";

import { AttachmentCellEditor } from "@/components/board/cells/attachment-cell";
import { DateCellEditor } from "@/components/board/cells/date-cell";
import { LongTextCellEditor } from "@/components/board/cells/long-text-cell";
import { RelationCellEditor } from "@/components/board/cells/relation-cell";
import { SelectCellEditor } from "@/components/board/cells/select-cell";
import { TextCellEditor } from "@/components/board/cells/text-cell";
import { UserCellEditor } from "@/components/board/cells/user-cell";
import type { CellMove } from "@/lib/cell-arrow-exit";
import { emptyCellFor, type CellContext } from "@/lib/cell-values";
import { stepNumberingOf } from "@/lib/step-numbering";
import type { BoardColumn, CellValue, DirectoryUser, SelectOption } from "@/types";

export interface CellEditorProps {
  readonly value: CellValue;
  readonly column: BoardColumn;
  readonly rowId: string;
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  readonly initialText?: string;
  readonly focusId?: string | undefined;
  readonly onCommit: (value: CellValue, move?: CellMove) => void;
  readonly onCancel: () => void;
  /**
   * Mũi tên chạm biên đoạn chữ thì ghi ô lại rồi sang ô kế bên.
   *
   * Chỉ bảng bật cờ này. Ngăn kéo chi tiết không có ô kế bên để đi tới, nên ở
   * đó mũi tên phải luôn thuộc về đoạn chữ.
   */
  readonly canExitByArrow?: boolean;
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
}

export function CellEditor(props: CellEditorProps) {
  const { column, value, onCommit, onCancel, canExitByArrow = false } = props;
  const safe = value.kind === column.type ? value : emptyCellFor(column.type);

  switch (column.type) {
    case "text":
      return safe.kind === "text" ? (
        <TextCellEditor
          value={safe}
          initialText={props.initialText}
          onCommit={onCommit}
          onCancel={onCancel}
          canExitByArrow={canExitByArrow}
        />
      ) : null;

    case "longText":
      return safe.kind === "longText" ? (
        <LongTextCellEditor
          value={safe}
          rows={column.config.rows}
          initialText={props.initialText}
          steps={stepNumberingOf(column.config)}
          label={column.name}
          onCommit={onCommit}
          onCancel={onCancel}
          canExitByArrow={canExitByArrow}
        />
      ) : null;

    case "select":
      return safe.kind === "select" ? (
        <SelectCellEditor
          value={safe}
          column={column}
          rowId={props.rowId}
          columns={props.columns}
          context={props.context}
          onCommit={onCommit}
          onCancel={onCancel}
          onCreateOption={props.onCreateOption}
        />
      ) : null;

    case "date":
      return safe.kind === "date" ? (
        <DateCellEditor value={safe} column={column} onCommit={onCommit} onCancel={onCancel} />
      ) : null;

    case "user":
      return safe.kind === "user" ? (
        <UserCellEditor
          value={safe}
          column={column}
          people={props.people}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : null;

    case "attachment":
      return (
        <AttachmentCellEditor
          column={column}
          rowId={props.rowId}
          folderId={props.folderId}
          focusId={props.focusId}
          onCancel={onCancel}
        />
      );

    case "relation":
      return safe.kind === "relation" ? (
        <RelationCellEditor
          value={safe}
          column={column}
          boardId={props.boardId}
          targetBoardId={column.config.boardId ?? props.boardId}
          primaryColumnId={column.config.displayColumnId ?? props.primaryColumnId}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : null;
  }
}
