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
import { RelationColumnDialog } from "@/components/board/config/relation-column-dialog";
import { useBoardPeople } from "@/hooks/use-board-people";
import { SelectColumnDialog } from "@/components/board/config/select-column-dialog";
import { StepNumberingDialog } from "@/components/board/config/step-numbering-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { COLUMN_TYPE_LABELS, isProtectedColumn } from "@/lib/board-schema";
import { DEFAULT_STEP_NUMBERING, stepNumberingOf } from "@/lib/step-numbering";
import { countFilledCells } from "@/lib/board-records";
import { DISPLAY_MODE_LABELS, isFlexibleColumn } from "@/lib/cell-display";
import { useBoardFolderId } from "@/hooks/use-folder-boards";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { BoardColumn, CellDisplayMode, ColumnType, PermissionResolver } from "@/types";

interface ColumnMenuProps {
  readonly column: BoardColumn;
  readonly columns: readonly BoardColumn[];
  readonly index: number;
  readonly can: PermissionResolver;
  readonly displayMode: CellDisplayMode;
  readonly onRename: () => void;
  readonly onConvert: (type: ColumnType) => void;
  readonly onSetDisplayMode: (mode: CellDisplayMode) => void;
  readonly onAutoFitWidth: () => void;
}

const TYPES = Object.keys(COLUMN_TYPE_LABELS) as readonly ColumnType[];
const DISPLAY_MODES: readonly CellDisplayMode[] = ["compact", "wrap", "full"];

const NEW_COLUMN_TYPE: ColumnType = "text";
const NEW_COLUMN_NAME = "New column";

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
  const people = useBoardPeople();
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);
  const addColumn = useBoardStore((state) => state.addColumn);
  const duplicateColumn = useBoardStore((state) => state.duplicateColumn);
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const nodeId = useBoardStore((state) => state.nodeId);
  const folderId = useBoardFolderId();

  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [isConfiguringSelect, setIsConfiguringSelect] = useState(false);
  const [isConfiguringSteps, setIsConfiguringSteps] = useState(false);
  const [isConfiguringRelation, setIsConfiguringRelation] = useState(false);

  const canEditSchema = can("board.column.update");
  const canAddColumn = can("board.column.create");
  const isProtected = isProtectedColumn(column);
  const isStepColumn =
    column.type === "longText" && stepNumberingOf(column.config).enabled;

  async function insertAt(at: number) {
    const created = await addColumn(NEW_COLUMN_TYPE, NEW_COLUMN_NAME, at);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  async function duplicate() {
    const created = await duplicateColumn(column.id);
    if (created) useGridStore.getState().beginColumnRename(created.id);
  }

  async function makeStepColumn() {
    if (column.type !== "longText") await convertColumn(column.id, "longText");

    const current = column.type === "longText" ? stepNumberingOf(column.config) : DEFAULT_STEP_NUMBERING;
    await updateColumnConfig(column.id, {
      config: { stepNumbering: { ...current, enabled: true } },
    });

    setIsConfiguringSteps(true);
  }

  /**
   * Mở cấu hình đánh số bước cho cột này.
   *
   * Cột chữ thường được chuyển sang long text ngay tại đây thay vì bắt người
   * dùng tự đi đổi kiểu trước: "đánh số bước" là điều họ muốn, "long text" chỉ
   * là cách hệ thống lưu nó. Bắt làm đúng thứ tự nội bộ của mình là bắt họ học
   * thuộc cấu trúc dữ liệu.
   */
  async function openStepNumbering() {
    if (column.type === "longText") {
      setIsConfiguringSteps(true);
      return;
    }

    await makeStepColumn();
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

        {column.type === "select" && (
          <DropdownMenuItem onSelect={() => setIsConfiguringSelect(true)}>
            <SlidersHorizontal />
            {canEditSchema ? "Options & rules…" : "Options & rules (read only)…"}
          </DropdownMenuItem>
        )}

        {(column.type === "longText" || column.type === "text") && (
          <DropdownMenuItem disabled={!canEditSchema} onSelect={() => void openStepNumbering()}>
            <ListOrdered />
            Step numbering…
          </DropdownMenuItem>
        )}

        {column.type === "relation" && (
          <DropdownMenuItem
            disabled={!canEditSchema}
            onSelect={() => setIsConfiguringRelation(true)}
          >
            <Link2 />
            Board đích &amp; số bản ghi…
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

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
          title={isProtected ? `“${column.name}” titles every record` : undefined}
          onSelect={askToDelete}
        >
          <Trash2 />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>

      <SelectColumnDialog
        column={isConfiguringSelect && column.type === "select" ? column : null}
        columns={columns}
        people={people}
        canEdit={canEditSchema}
        onClose={() => setIsConfiguringSelect(false)}
        onSave={(config) => void updateColumnConfig(column.id, { config })}
      />

      <RelationColumnDialog
        key={isConfiguringRelation ? "open" : "closed"}
        isOpen={isConfiguringRelation}
        column={column.type === "relation" ? column : null}
        folderId={folderId}
        currentNodeId={nodeId ?? ""}
        onClose={() => setIsConfiguringRelation(false)}
        onSave={({ name, config }) => {
          void updateColumnConfig(column.id, { name, config });
          setIsConfiguringRelation(false);
        }}
      />

      <StepNumberingDialog
        column={isConfiguringSteps && column.type === "longText" ? column : null}
        onClose={() => setIsConfiguringSteps(false)}
        onSave={(stepNumbering) => void updateColumnConfig(column.id, { config: { stepNumbering } })}
      />

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
