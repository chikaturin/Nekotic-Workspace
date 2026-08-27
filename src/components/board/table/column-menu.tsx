"use client";

import {
  AlignLeft,
  ArrowDownAZ,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpAZ,
  Copy,
  EyeOff,
  Link2,
  ListOrdered,
  MoreHorizontal,
  MoveHorizontal,
  Pencil,
  Shuffle,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { SelectColumnDialog } from "@/components/board/config/select-column-dialog";
import { StepNumberingDialog } from "@/components/board/config/step-numbering-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBoardList } from "@/hooks/use-board-list";
import { COLUMN_TYPE_LABELS, isProtectedColumn } from "@/lib/board-schema";
import { DEFAULT_STEP_NUMBERING, stepNumberingOf } from "@/lib/step-numbering";
import { countFilledCells } from "@/lib/board-records";
import { DISPLAY_MODE_LABELS, isFlexibleColumn } from "@/lib/cell-display";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { BoardColumn, CellDisplayMode, ColumnType, PermissionResolver } from "@/types";

interface ColumnMenuProps {
  readonly column: BoardColumn;
  /** Every column on the board — what an option rule can be written against. */
  readonly columns: readonly BoardColumn[];
  /** Where this column sits in the view, so Insert left/right has an anchor. */
  readonly index: number;
  /**
   * Reshaping a column is a manager's job; sorting and hiding one is how
   * anybody reads a board. The menu holds both, so it asks per item rather
   * than being handed a single "read only" flag for all of them.
   */
  readonly can: PermissionResolver;
  readonly displayMode: CellDisplayMode;
  readonly onRename: () => void;
  readonly onConvert: (type: ColumnType) => void;
  readonly onSetDisplayMode: (mode: CellDisplayMode) => void;
  readonly onAutoFitWidth: () => void;
}

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];
const DISPLAY_MODES: readonly CellDisplayMode[] = ["compact", "wrap", "full"];

/** What a new column inserted beside this one is called and made of. */
const NEW_COLUMN_TYPE: ColumnType = "text";
const NEW_COLUMN_NAME = "New column";

/** Everything a column can do, at the header where the user is looking. */
export function ColumnMenu({
  column,
  columns,
  index,
  can,
  displayMode,
  onRename,
  onConvert,
  onSetDisplayMode,
  onAutoFitWidth,
}: ColumnMenuProps) {
  const convertColumn = useBoardStore((state) => state.convertColumn);
  const setSort = useBoardStore((state) => state.setSort);
  const people = useBoardStore((state) => state.people);
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);
  const addColumn = useBoardStore((state) => state.addColumn);
  const duplicateColumn = useBoardStore((state) => state.duplicateColumn);
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const boards = useBoardList();

  /**
   * `null` while nothing is being deleted, otherwise how many records hold a
   * value in this column. It is counted when the item is chosen rather than on
   * every render: the answer needs a pass over every record, and it is only
   * ever needed to word one sentence.
   */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [isConfiguringSelect, setIsConfiguringSelect] = useState(false);
  const [isConfiguringSteps, setIsConfiguringSteps] = useState(false);

  const canEditSchema = can("board.column.update");
  const canAddColumn = can("board.column.create");
  const isProtected = isProtectedColumn(column);
  const isStepColumn =
    column.type === "longText" && stepNumberingOf(column.config).enabled;

  /** Insert and duplicate both leave the new column ready to be named. */
  async function insertAt(at: number) {
    const created = await addColumn(NEW_COLUMN_TYPE, NEW_COLUMN_NAME, at);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  async function duplicate() {
    const created = await duplicateColumn(column.id);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  /**
   * Steps is a *preset*, not an eighth cell type.
   *
   * A QA step column is a long-text column with numbering switched on — the
   * shared table engine already does both — so this sets the two together
   * rather than adding a type the whole schema would have to learn. Offering it
   * beside the types is the point: "Steps" is what the user is looking for, and
   * "Long text, then open a second dialog" is not.
   *
   * The conversion needs no preview because Long text is the one type that
   * parses everything: nothing can fail to convert into it.
   */
  async function makeStepColumn() {
    if (column.type !== "longText") await convertColumn(column.id, "longText");

    const current = column.type === "longText" ? stepNumberingOf(column.config) : DEFAULT_STEP_NUMBERING;
    await updateColumnConfig(column.id, {
      config: { stepNumbering: { ...current, enabled: true } },
    });

    setIsConfiguringSteps(true);
  }

  function askToDelete() {
    const { rowsById, rowOrder } = useBoardStore.getState();
    setPendingDelete(countFilledCells(rowsById, rowOrder, column.id));
  }

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${column.name} column options`}
          // The header renames on double-click; two clicks on this button are
          // two attempts to open the menu.
          onDoubleClick={(event) => event.stopPropagation()}
          className="flex size-5 shrink-0 items-center justify-center rounded text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/head:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{column.name}</DropdownMenuLabel>

        <DropdownMenuItem disabled={!canEditSchema} onSelect={onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!canEditSchema}>
            <Shuffle />
            Change type
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {TYPES.map((type) => (
              <DropdownMenuItem
                key={type}
                disabled={type === column.type}
                onSelect={() => onConvert(type)}
              >
                {COLUMN_TYPE_LABELS[type]}
                {type === column.type && (
                  <span className="ml-auto text-micro text-faint-foreground">current</span>
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => void makeStepColumn()}>
              <ListOrdered />
              <span className="min-w-0">
                <span className="block">Steps</span>
                <span className="block text-micro text-faint-foreground">
                  Long text, numbered B1, B2, B3…
                </span>
              </span>
              {isStepColumn && (
                <span className="ml-auto shrink-0 text-micro text-faint-foreground">current</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Not gated: what this opens is read-only without
            `board.column.update`, and the workflow it shows is exactly what a
            member needs to read when a status change is refused. */}
        {column.type === "select" && (
          <DropdownMenuItem onSelect={() => setIsConfiguringSelect(true)}>
            <SlidersHorizontal />
            {canEditSchema ? "Options & rules…" : "Options & rules (read only)…"}
          </DropdownMenuItem>
        )}

        {column.type === "longText" && (
          <DropdownMenuItem disabled={!canEditSchema} onSelect={() => setIsConfiguringSteps(true)}>
            <ListOrdered />
            Step numbering…
          </DropdownMenuItem>
        )}

        {column.type === "relation" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canEditSchema}>
              <Link2 />
              Linked board
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.boardId}
                  disabled={column.config.boardId === board.boardId}
                  onSelect={() =>
                    void updateColumnConfig(column.id, { config: { boardId: board.boardId } })
                  }
                >
                  {board.name}
                  {column.config.boardId === board.boardId && (
                    <span className="ml-auto text-micro text-faint-foreground">linked</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        {/* How much of a cell this view shows. Open to everyone: it changes
            nothing about the data, only what the reader sees of it. Offered
            only where it would do something — a chip or an avatar shows no
            more of itself on a second line. */}
        {isFlexibleColumn(column) && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AlignLeft />
            Display
            <span className="ml-auto text-micro text-faint-foreground">
              {DISPLAY_MODE_LABELS[displayMode].label}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {DISPLAY_MODES.map((mode) => (
              <DropdownMenuItem
                key={mode}
                disabled={mode === displayMode}
                onSelect={() => onSetDisplayMode(mode)}
              >
                <span className="min-w-0">
                  <span className="block">{DISPLAY_MODE_LABELS[mode].label}</span>
                  <span className="block text-micro text-faint-foreground">
                    {DISPLAY_MODE_LABELS[mode].summary}
                  </span>
                </span>
                {mode === displayMode && (
                  <span className="ml-auto shrink-0 text-micro text-faint-foreground">current</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        )}

        <DropdownMenuItem onSelect={onAutoFitWidth}>
          <MoveHorizontal />
          Auto fit width
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void setSort(column.id, "asc")}>
          <ArrowUpAZ />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void setSort(column.id, "desc")}>
          <ArrowDownAZ />
          Sort descending
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Position, not array index: the schema renumbers everything after
            the insert, so "left of this one" is this column's own place. */}
        <DropdownMenuItem disabled={!canAddColumn} onSelect={() => void insertAt(index)}>
          <ArrowLeftToLine />
          Insert column left
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canAddColumn} onSelect={() => void insertAt(index + 1)}>
          <ArrowRightToLine />
          Insert column right
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canAddColumn} onSelect={() => void duplicate()}>
          <Copy />
          Duplicate column
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isProtected}
          onSelect={() => void setColumnHidden(column.id, true)}
        >
          <EyeOff />
          Hide column
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="danger"
          disabled={isProtected || !can("board.column.delete")}
          // The one column that cannot go is the one that titles a record.
          // Nothing else is protected — including a column an import created.
          title={isProtected ? `“${column.name}” titles every record` : undefined}
          onSelect={askToDelete}
        >
          <Trash2 />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>

      {/* Options, their conditions and the transition table are one write:
          the dialog commits a whole config so a half-written rule never lands. */}
      <SelectColumnDialog
        column={isConfiguringSelect && column.type === "select" ? column : null}
        columns={columns}
        people={people}
        canEdit={canEditSchema}
        onClose={() => setIsConfiguringSelect(false)}
        onSave={(config) => void updateColumnConfig(column.id, { config })}
      />

      <StepNumberingDialog
        column={isConfiguringSteps && column.type === "longText" ? column : null}
        onClose={() => setIsConfiguringSteps(false)}
        onSave={(stepNumbering) => void updateColumnConfig(column.id, { config: { stepNumbering } })}
      />

      {/* Deleting a column takes its value out of every record on the board.
          A column nobody has written into says so plainly rather than warning
          about data that is not there. */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete “${column.name}”?`}
        description={
          pendingDelete && pendingDelete > 0
            ? `This removes the column and its value from ${pendingDelete === 1 ? "1 record" : `all ${pendingDelete} records that hold one`}, and from every view that referenced it. This cannot be undone.`
            : "No record holds a value in this column. It is removed from the board and from every view that referenced it."
        }
        confirmLabel="Delete column"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          setPendingDelete(null);
          void deleteColumn(column.id);
        }}
      />
    </>
  );
}
