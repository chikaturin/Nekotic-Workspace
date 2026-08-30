"use client";

import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Pencil,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { SaveIndicator } from "@/components/document/save-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHotkey } from "@/hooks/use-hotkey";
import { useSheetEditor } from "@/hooks/use-file-editor";
import {
  addGridColumn,
  addGridRow,
  columnLabel,
  gridColumnCount,
  removeGridColumn,
  removeGridRow,
  setGridCell,
  type Grid,
} from "@/lib/grid";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types";

interface SheetPreviewProps {
  readonly rows: Grid;
  readonly sheetName: string;
  readonly node: FileNode;
  readonly canEdit: boolean;
  readonly onSaved: () => void;
}

export function SheetPreview({ rows, sheetName, node, canEdit, onSaved }: SheetPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editor = useSheetEditor(node, rows);

  const shown = editor.isEditing ? editor.draft : rows;
  const columns = gridColumnCount(shown);

  function apply(next: Grid) {
    editor.change(next);
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>(`[data-cell="${rowIndex}-${columnIndex}"]`)
        ?.focus();
    });
  }

  async function commit() {
    if (await editor.save(editor.draft)) onSaved();
  }

  /**
   * Cmd/Ctrl+S lưu TỆP, không phải lưu trang.
   *
   * Handler cũ nằm trên chính ô nhập, nên chỉ chạy khi con trỏ đang ở trong đó.
   * Bấm một nút trên thanh công cụ rồi Ctrl+S là phím rơi thẳng ra trình duyệt
   * và nó mở hộp thoại lưu .html — người dùng tưởng đã lưu, thực ra chưa.
   *
   * Gắn ở tầng document nên bắt được ở mọi chỗ trong lúc đang sửa;
   * `enableInInputs` để nó vẫn chạy khi con trỏ nằm trong ô nhập.
   */
  useHotkey("mod+s", () => void commit(), {
    enabled: editor.isEditing,
    enableInInputs: true,
  });

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void commit();
      return;
    }

    const isLastCell = rowIndex === shown.length - 1 && columnIndex === columns - 1;

    if (event.key === "Tab" && !event.shiftKey && isLastCell) {
      event.preventDefault();
      apply(addGridRow(shown));
      focusCell(shown.length, 0);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (rowIndex === shown.length - 1) {
        apply(addGridRow(shown));
        focusCell(shown.length, columnIndex);
        return;
      }
      focusCell(rowIndex + 1, columnIndex);
      return;
    }

    if (event.key === "ArrowUp" && rowIndex > 0) {
      event.preventDefault();
      focusCell(rowIndex - 1, columnIndex);
    }
    if (event.key === "ArrowDown" && rowIndex < shown.length - 1) {
      event.preventDefault();
      focusCell(rowIndex + 1, columnIndex);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-4 py-2 backdrop-blur">
        <Badge variant="default">
          <Table2 className="size-3" />
          {sheetName}
        </Badge>
        <span className="metric text-micro text-faint-foreground">
          {shown.length} × {columns}
        </span>

        {editor.isEditing && <SaveIndicator state={editor.saveState} onRetry={() => void commit()} />}

        <div className="ml-auto flex items-center gap-1">
          {canEdit && !editor.isEditing && (
            <Button size="sm" variant="outline" onClick={editor.start} className="gap-1.5">
              <Pencil />
              Edit
            </Button>
          )}

          {editor.isEditing && (
            <>
              <Button size="sm" variant="ghost" onClick={editor.discard} className="gap-1.5">
                <X />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!editor.isDirty || editor.saveState.status === "saving"}
                onClick={() => void commit()}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-surface">
        <table className="border-collapse text-code">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-sticky w-10 border-b border-r border-border bg-hover" />
              {Array.from({ length: columns }, (_, columnIndex) => (
                <th
                  key={columnIndex}
                  scope="col"
                  className="sticky top-0 z-sticky border-b border-r border-border bg-hover px-0 py-1"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="metric text-micro font-medium text-muted-foreground">
                      {columnLabel(columnIndex)}
                    </span>
                    {editor.isEditing && (
                      <AxisMenu
                        label={`Column ${columnLabel(columnIndex)} options`}
                        canDelete={columns > 1}
                        items={[
                          { icon: ArrowLeftToLine, label: "Insert column left", at: columnIndex },
                          { icon: ArrowRightToLine, label: "Insert column right", at: columnIndex + 1 },
                        ]}
                        deleteLabel="Delete column"
                        onInsert={(at) => {
                          apply(addGridColumn(shown, at));
                          focusCell(0, at);
                        }}
                        onDelete={() => apply(removeGridColumn(shown, columnIndex))}
                      />
                    )}
                  </div>
                </th>
              ))}
              {editor.isEditing && (
                <th scope="col" className="sticky top-0 z-sticky border-b border-border bg-hover p-0">
                  <EdgeAdd
                    label="Add column"
                    onClick={() => {
                      apply(addGridColumn(shown));
                      focusCell(0, columns);
                    }}
                  />
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {shown.map((row, rowIndex) => (
              <tr key={rowIndex} className="group/row">
                <th
                  scope="row"
                  className="sticky left-0 z-sticky border-b border-r border-border bg-hover px-0 py-0 text-center"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="metric text-micro font-normal text-faint-foreground">
                      {rowIndex + 1}
                    </span>
                    {editor.isEditing && (
                      <AxisMenu
                        label={`Row ${rowIndex + 1} options`}
                        canDelete={shown.length > 1}
                        items={[
                          { icon: ArrowUpToLine, label: "Insert row above", at: rowIndex },
                          { icon: ArrowDownToLine, label: "Insert row below", at: rowIndex + 1 },
                        ]}
                        deleteLabel="Delete row"
                        onInsert={(at) => {
                          apply(addGridRow(shown, at));
                          focusCell(at, 0);
                        }}
                        onDelete={() => apply(removeGridRow(shown, rowIndex))}
                      />
                    )}
                  </div>
                </th>

                {Array.from({ length: columns }, (_, columnIndex) => {
                  const value = row[columnIndex] ?? "";

                  return (
                    <td key={columnIndex} className="border-b border-r border-hairline p-0">
                      {editor.isEditing ? (
                        <input
                          value={value}
                          data-cell={`${rowIndex}-${columnIndex}`}
                          onChange={(event) =>
                            apply(setGridCell(shown, rowIndex, columnIndex, event.target.value))
                          }
                          onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                          aria-label={`${columnLabel(columnIndex)}${rowIndex + 1}`}
                          className="metric w-full min-w-32 bg-transparent px-2 py-1 text-foreground outline-none focus-visible:bg-accent-soft"
                        />
                      ) : (
                        <span
                          className={cn(
                            "metric block min-w-32 truncate px-2 py-1",
                            rowIndex === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}

                {editor.isEditing && <td className="border-b border-hairline" />}
              </tr>
            ))}

            {editor.isEditing && (
              <tr>
                <th scope="row" className="sticky left-0 z-sticky border-r border-border bg-hover p-0" />
                <td colSpan={columns} className="p-0">
                  <EdgeAdd
                    label="Add row"
                    onClick={() => {
                      apply(addGridRow(shown));
                      focusCell(shown.length, 0);
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EdgeAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-6 w-full items-center justify-center text-faint-foreground transition-colors hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

interface AxisMenuProps {
  readonly label: string;
  readonly canDelete: boolean;
  readonly items: readonly {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    at: number;
  }[];
  readonly deleteLabel: string;
  readonly onInsert: (at: number) => void;
  readonly onDelete: () => void;
}

function AxisMenu({ label, canDelete, items, deleteLabel, onInsert, onDelete }: AxisMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex size-4 items-center justify-center rounded text-faint-foreground opacity-0 transition-opacity hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100 [th:hover_&]:opacity-100"
        >
          <span aria-hidden className="text-micro leading-none">
            ▾
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={() => onInsert(item.at)}>
            <item.icon />
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canDelete} onSelect={onDelete}>
          <Trash2 />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
