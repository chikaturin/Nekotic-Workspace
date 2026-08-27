"use client";

import { ListTree, Plus, Unlink } from "lucide-react";
import { useState } from "react";
import { SubtaskComposer } from "@/components/board/drawer/subtask-composer";
import { CellRenderer } from "@/components/board/cells/cell-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useSubtasks } from "@/hooks/use-subtasks";
import { cellOf, isCellEmpty, type CellContext } from "@/lib/cell-values";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import type { BoardColumn, CellValue, DirectoryUser } from "@/types";

interface SubtaskPanelProps {
  readonly parentRowId: string;
  readonly parentDisplayId: string;
  readonly columns: readonly BoardColumn[];
  readonly primaryColumnId: string;
  readonly context: CellContext;
  readonly people: readonly DirectoryUser[];
  readonly canEdit: boolean;
}

/** Fields shown beside a subtask's title, in the order the board declares them. */
const CHIP_TYPES: readonly BoardColumn["type"][] = ["select", "user", "date"];

/**
 * Subtasks of one record.
 *
 * Every line here is a board record with its own display id, status, owner and
 * history — clicking one opens *its* drawer, with its own comments, activity
 * and attachments. Nothing about a subtask is stored on the parent, which is
 * why ticking one in the table updates this list, and vice versa, with no
 * synchronisation code anywhere.
 *
 * Completing every subtask deliberately does *not* complete the parent. That
 * would be an automation rule, and no such rule has been configured — the
 * progress bar reports, it does not act.
 */
export function SubtaskPanel({
  parentRowId,
  parentDisplayId,
  columns,
  primaryColumnId,
  context,
  people,
  canEdit,
}: SubtaskPanelProps) {
  const { entries, progress, completionColumn } = useSubtasks(parentRowId, columns);
  const createSubtask = useBoardStore((state) => state.createSubtask);
  const setRowParent = useBoardStore((state) => state.setRowParent);
  const editCells = useBoardStore((state) => state.editCells);
  const openDrawer = useGridStore((state) => state.openDrawer);

  const [isComposing, setIsComposing] = useState(false);

  const chipColumns = columns.filter(
    (column) => !column.isPrimary && CHIP_TYPES.includes(column.type),
  );

  /**
   * Ticking the box writes the completion column on the subtask — the same
   * cell edit the grid would make, through the same store action, so the same
   * transition rules apply.
   */
  function toggleCompleted(rowId: string, isCompleted: boolean) {
    if (!completionColumn || !canEdit) return;

    const completedId = completionColumn.config.completedOptionIds?.[0];
    if (!completedId) return;

    const value: CellValue = isCompleted
      ? { kind: "select", optionIds: [] }
      : { kind: "select", optionIds: [completedId] };

    void editCells([{ rowId, columnId: completionColumn.id, value }]);
  }

  return (
    <section aria-label="Subtasks" className="space-y-2">
      <header className="flex items-center gap-2">
        <ListTree className="size-3.5 shrink-0 text-faint-foreground" />
        <h3 className="text-ui font-medium text-foreground">Subtasks</h3>

        {entries.length > 0 && <Badge variant="default">{entries.length}</Badge>}

        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 gap-1 px-1.5 text-body"
            onClick={() => setIsComposing(true)}
          >
            <Plus />
            Add subtask
          </Button>
        )}
      </header>

      {entries.length > 0 && progress.isMeasurable && (
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="metric text-body text-muted-foreground">
              {progress.completed} / {progress.total} completed
            </span>
            <span className="metric ml-auto text-body text-faint-foreground">
              {progress.percent}%
            </span>
          </div>
          <Progress
            value={progress.ratio}
            label={`${progress.completed} of ${progress.total} subtasks of ${parentDisplayId} completed`}
          />
        </div>
      )}

      {entries.length === 0 && !isComposing && (
        <p className="text-ui text-faint-foreground">
          No subtasks yet. Break this record into smaller ones — each becomes a record of its own.
        </p>
      )}

      {entries.length > 0 && (
        <ul className="space-y-0.5">
          {entries.map(({ row, isCompleted, childCount }) => {
            const title = row.cells[primaryColumnId];
            const label = title && title.kind === "text" ? title.value : "";

            return (
              <li
                key={row.id}
                className="group/subtask flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-hover"
              >
                <Checkbox
                  checked={isCompleted}
                  disabled={!canEdit || !completionColumn}
                  aria-label={`Mark ${row.displayId} ${isCompleted ? "not done" : "done"}`}
                  onChange={() => toggleCompleted(row.id, isCompleted)}
                />

                <button
                  type="button"
                  onClick={() => openDrawer(row.id)}
                  className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                >
                  <span className="metric shrink-0 text-micro text-faint-foreground">
                    {row.displayId}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-ui",
                      isCompleted ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {label || "Untitled"}
                  </span>
                </button>

                {childCount > 0 && (
                  <Badge variant="default" className="shrink-0">
                    {childCount}
                  </Badge>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  {chipColumns.map((column) => {
                    const value = cellOf(row, column);
                    if (isCellEmpty(value)) return null;

                    return (
                      <div key={column.id} className="max-w-32 [&_>div]:px-0">
                        <CellRenderer value={value} column={column} context={context} />
                      </div>
                    );
                  })}
                </div>

                {canEdit && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Detach ${row.displayId} from ${parentDisplayId}`}
                    title="Move to the top level — the record itself is kept"
                    onClick={() => void setRowParent(row.id, null)}
                    className="shrink-0 opacity-0 group-hover/subtask:opacity-100 focus-visible:opacity-100"
                  >
                    <Unlink />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isComposing && canEdit && (
        <SubtaskComposer
          columns={columns}
          primaryColumnId={primaryColumnId}
          people={people}
          onCreate={async (values) => {
            await createSubtask(parentRowId, values);
          }}
          onCancel={() => setIsComposing(false)}
        />
      )}
    </section>
  );
}
