"use client";

import { AttachmentCellEditor } from "@/components/board/cells/attachment-cell";
import { DateCellEditor } from "@/components/board/cells/date-cell";
import { LongTextCellEditor } from "@/components/board/cells/long-text-cell";
import { RelationCellEditor } from "@/components/board/cells/relation-cell";
import { SelectCellEditor } from "@/components/board/cells/select-cell";
import { TextCellEditor } from "@/components/board/cells/text-cell";
import { UserCellEditor } from "@/components/board/cells/user-cell";
import { emptyCellFor, type CellContext } from "@/lib/cell-values";
import type { BoardColumn, CellValue, DirectoryUser, SelectOption } from "@/types";

export interface CellEditorProps {
  readonly value: CellValue;
  readonly column: BoardColumn;
  readonly rowId: string;
  readonly boardId: string;
  readonly primaryColumnId: string;
  /** Folder that attachment uploads are filed into. */
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  /** The board's schema and lookups — what an option rule is evaluated against. */
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  readonly initialText?: string;
  readonly onCommit: (value: CellValue, move?: "down" | "none") => void;
  readonly onCancel: () => void;
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
}

/**
 * One editor per cell type. Every editor gets the same contract — commit a
 * value or cancel — so the grid never needs to know which type it opened.
 */
export function CellEditor(props: CellEditorProps) {
  const { column, value, onCommit, onCancel } = props;
  const safe = value.kind === column.type ? value : emptyCellFor(column.type);

  switch (column.type) {
    case "text":
      return safe.kind === "text" ? (
        <TextCellEditor
          value={safe}
          initialText={props.initialText}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : null;

    case "longText":
      return safe.kind === "longText" ? (
        <LongTextCellEditor
          value={safe}
          rows={column.config.rows}
          initialText={props.initialText}
          onCommit={onCommit}
          onCancel={onCancel}
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
      // The attachment editor writes through the board record itself, so it
      // takes no value and returns none — see `use-attachment-field`.
      return (
        <AttachmentCellEditor
          column={column}
          rowId={props.rowId}
          folderId={props.folderId}
          onCancel={onCancel}
        />
      );

    case "relation":
      return safe.kind === "relation" ? (
        <RelationCellEditor
          value={safe}
          column={column}
          targetBoardId={column.config.boardId ?? props.boardId}
          primaryColumnId={column.config.displayColumnId ?? props.primaryColumnId}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ) : null;
  }
}
