"use client";

import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  GripHorizontal,
  GripVertical,
  Heading,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addTableColumn,
  addTableRow,
  columnCount,
  removeTableColumn,
  removeTableRow,
  setTableCell,
  toggleHeaderRow,
} from "@/lib/table";
import { cn } from "@/lib/utils";
import type { TableBlock as TableBlockModel } from "@/types";

interface TableBlockProps {
  readonly block: TableBlockModel;
  readonly onChange: (block: TableBlockModel) => void;
  readonly isEditable: boolean;
}

/**
 * Grid with the controls where the work is: a menu on every row and column,
 * one-click add bars along the right and bottom edges, and Tab/Enter that grow
 * the table as you type.
 */
export function TableBlock({ block, onChange, isEditable }: TableBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columns = columnCount(block);
  const rows = block.rows.length;

  /** Cells are addressed by coordinate so growth can hand focus straight on. */
  function focusCell(rowIndex: number, columnIndex: number) {
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)
        ?.focus();
    });
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    const isLastCell = rowIndex === rows - 1 && columnIndex === columns - 1;

    if (event.key === "Tab" && !event.shiftKey && isLastCell) {
      event.preventDefault();
      onChange(addTableRow(block));
      focusCell(rows, 0);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (rowIndex === rows - 1) {
        onChange(addTableRow(block));
        focusCell(rows, columnIndex);
        return;
      }
      focusCell(rowIndex + 1, columnIndex);
    }
  }

  return (
    <div ref={containerRef} className="group/table overflow-x-auto pb-1">
      <table className="border-separate border-spacing-0 text-[13px]">
        <tbody>
          {isEditable && (
            <tr>
              <td className="w-6 p-0">
                <HeaderToggle block={block} onChange={onChange} />
              </td>

              {block.rows[0]?.map((_, columnIndex) => (
                <td key={columnIndex} className="p-0 pb-1">
                  <ColumnMenu
                    columnIndex={columnIndex}
                    canDelete={columns > 1}
                    onInsert={(at) => {
                      onChange(addTableColumn(block, at));
                      focusCell(0, at);
                    }}
                    onDelete={() => onChange(removeTableColumn(block, columnIndex))}
                  />
                </td>
              ))}

              <td rowSpan={rows + 1} className="p-0 pl-1 align-top">
                <EdgeAdd
                  orientation="vertical"
                  label="Add column"
                  onClick={() => {
                    onChange(addTableColumn(block));
                    focusCell(0, columns);
                  }}
                />
              </td>
            </tr>
          )}

          {block.rows.map((row, rowIndex) => {
            const isHeader = block.hasHeaderRow && rowIndex === 0;
            const Cell = isHeader ? "th" : "td";

            return (
              <tr key={rowIndex} className="group/row">
                {isEditable && (
                  <td className="w-6 p-0 pr-1">
                    <RowMenu
                      rowIndex={rowIndex}
                      canDelete={rows > 1}
                      onInsert={(at) => {
                        onChange(addTableRow(block, at));
                        focusCell(at, 0);
                      }}
                      onDelete={() => onChange(removeTableRow(block, rowIndex))}
                    />
                  </td>
                )}

                {row.map((cell, columnIndex) => (
                  <Cell
                    key={columnIndex}
                    scope={isHeader ? "col" : undefined}
                    className={cn(
                      "border-b border-r border-hairline p-0 align-top",
                      columnIndex === 0 && "border-l",
                      rowIndex === 0 && "border-t",
                      isHeader && "bg-hover",
                    )}
                  >
                    <input
                      value={cell}
                      readOnly={!isEditable}
                      data-cell={`${rowIndex}-${columnIndex}`}
                      onChange={(event) =>
                        onChange(setTableCell(block, rowIndex, columnIndex, event.target.value))
                      }
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                      aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      placeholder={isHeader ? "Column" : ""}
                      className={cn(
                        "w-full min-w-[8rem] bg-transparent px-2.5 py-1.5 outline-none",
                        "placeholder:text-faint-foreground focus-visible:bg-accent-soft",
                        isHeader ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    />
                  </Cell>
                ))}
              </tr>
            );
          })}

          {isEditable && (
            <tr>
              <td />
              <td colSpan={columns} className="p-0 pt-1">
                <EdgeAdd
                  orientation="horizontal"
                  label="Add row"
                  onClick={() => {
                    onChange(addTableRow(block));
                    focusCell(rows, 0);
                  }}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/** Thin bar along an edge — one click appends a row or a column. */
function EdgeAdd({
  orientation,
  label,
  onClick,
}: {
  orientation: "horizontal" | "vertical";
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "flex items-center justify-center rounded-md border border-dashed border-transparent",
            "text-faint-foreground opacity-0 transition-all",
            "hover:border-accent hover:bg-accent-soft hover:text-accent",
            "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/table:opacity-100",
            orientation === "vertical" ? "h-full w-6" : "h-6 w-full",
          )}
        >
          <Plus className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ColumnMenu({
  columnIndex,
  canDelete,
  onInsert,
  onDelete,
}: {
  columnIndex: number;
  canDelete: boolean;
  onInsert: (at: number) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Column ${columnIndex + 1} options`}
          className="flex h-5 w-full items-center justify-center rounded text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/table:opacity-100"
        >
          <GripHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onInsert(columnIndex)}>
          <ArrowLeftToLine />
          Insert column left
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert(columnIndex + 1)}>
          <ArrowRightToLine />
          Insert column right
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canDelete} onSelect={onDelete}>
          <Trash2 />
          Delete column
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowMenu({
  rowIndex,
  canDelete,
  onInsert,
  onDelete,
}: {
  rowIndex: number;
  canDelete: boolean;
  onInsert: (at: number) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Row ${rowIndex + 1} options`}
          className="flex h-full min-h-7 w-5 items-center justify-center rounded text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <GripVertical className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onInsert(rowIndex)}>
          <ArrowUpToLine />
          Insert row above
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert(rowIndex + 1)}>
          <ArrowDownToLine />
          Insert row below
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canDelete} onSelect={onDelete}>
          <Trash2 />
          Delete row
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderToggle({
  block,
  onChange,
}: {
  block: TableBlockModel;
  onChange: (block: TableBlockModel) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant={block.hasHeaderRow ? "subtle" : "ghost"}
          aria-pressed={block.hasHeaderRow}
          aria-label="Toggle header row"
          onClick={() => onChange(toggleHeaderRow(block))}
          className="size-5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/table:opacity-100"
        >
          <Heading />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{block.hasHeaderRow ? "Remove header row" : "Use header row"}</TooltipContent>
    </Tooltip>
  );
}
