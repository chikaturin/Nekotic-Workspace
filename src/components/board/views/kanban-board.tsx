"use client";

import { Lock, Plus } from "lucide-react";
import { useCallback, useMemo, useState, type DragEvent } from "react";
import { RecordCard } from "@/components/board/views/record-card";
import { StatePanel } from "@/components/shared/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { groupValueFor, UNGROUPED_KEY, type RowGroup } from "@/lib/board-grouping";
import { evaluateTransition, transitionKeyOf } from "@/lib/transition-rules";
import { groupKeyOf } from "@/lib/board-grouping";
import { formatCount } from "@/lib/format";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

const CARDS_PER_PAGE = 40;

interface KanbanBoardProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

/**
 * Kanban is the group engine with a horizontal layout: a column *is* a group,
 * and a card *is* a row id. Dropping a card writes the group column's cell on
 * the board record — the same mutation the table would make.
 */
export function KanbanBoard({ model, canEdit }: KanbanBoardProps) {
  const { groupColumn, groups, columnsShown, context, board } = model;
  const editCells = useBoardStore((state) => state.editCells);
  const addRow = useBoardStore((state) => state.addRow);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  /** Cards mounted per column — a 5.000-record board must not build 5.000 DOM cards. */
  const [limits, setLimits] = useState<Readonly<Record<string, number>>>({});

  const cardFields = columnsShown.filter(
    (column) => !column.isPrimary && column.id !== groupColumn?.id,
  );

  const rowsById = useBoardStore((state) => state.rowsById);

  /**
   * A drop asks two separate questions, in order:
   *
   *   1. Permission — "may this user change Status at all?"
   *   2. Transition rule — "may Status go from where it is to here?"
   *
   * They are deliberately not merged: the first is about the person, the
   * second about the record, and a refusal from each says something different.
   * Either refusal returns before the optimistic write, so the card snaps back
   * to its column and no request is made.
   */
  const drop = useCallback(
    (group: RowGroup, rowId: string) => {
      if (!groupColumn) return;

      if (!canEdit) {
        pushFeedback(`You do not have permission to change ${groupColumn.name}`, "error");
        return;
      }

      if (groupColumn.type === "select") {
        const from = transitionKeyOf(groupKeyOf(rowId, rowsById, groupColumn));
        const verdict = evaluateTransition(groupColumn, from, transitionKeyOf(group.key));

        if (!verdict.isAllowed) {
          pushFeedback(verdict.reason ?? "That status change is not allowed", "error");
          return;
        }
      }

      const value = groupValueFor(groupColumn, group.key);
      if (!value) return;

      void editCells([{ rowId, columnId: groupColumn.id, value }]);
    },
    [groupColumn, canEdit, editCells, pushFeedback, rowsById],
  );

  /**
   * Which columns the card being dragged may actually land in. Shown while a
   * drag is in flight so a refused drop is visible before it is attempted,
   * rather than only as a toast afterwards.
   */
  const reachable = useMemo<ReadonlySet<string> | null>(() => {
    if (!draggingId || !groupColumn || groupColumn.type !== "select") return null;

    const rules = groupColumn.config.transitionRules;
    if (!rules?.enabled) return null;

    const from = transitionKeyOf(groupKeyOf(draggingId, rowsById, groupColumn));
    return new Set([from, ...(rules.transitions[from] ?? [])]);
  }, [draggingId, groupColumn, rowsById]);

  if (!groupColumn || !groups) {
    return (
      <div className="min-h-0 flex-1 p-6">
        <StatePanel
          icon={Lock}
          title="Pick a column to group by"
          description="Kanban needs a Select or User column to build its columns from. Choose one in Group."
        />
      </div>
    );
  }

  /** True when a transition rule permits the dragged card to land here. */
  function isDroppable(groupKey: string): boolean {
    return reachable === null || reachable.has(transitionKeyOf(groupKey));
  }

  function handleDrop(event: DragEvent<HTMLElement>, group: RowGroup) {
    event.preventDefault();
    setOverKey(null);
    setDraggingId(null);

    const rowId = event.dataTransfer.getData("text/plain");
    if (rowId) drop(group, rowId);
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-canvas">
      <div className="flex h-full min-w-max items-stretch gap-3 p-3">
        {groups.map((group) => (
          <section
            key={group.key}
            aria-label={group.label}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect =
                canEdit && isDroppable(group.key) ? "move" : "none";
              setOverKey(group.key);
            }}
            onDragLeave={() => setOverKey((key) => (key === group.key ? null : key))}
            onDrop={(event) => handleDrop(event, group)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-background/60 transition-colors",
              overKey === group.key && draggingId
                ? canEdit && isDroppable(group.key)
                  ? "border-accent bg-accent-soft"
                  : "border-danger/40 bg-danger/5"
                : "border-border",
              // A rule that forbids this column says so while the card is in
              // the air, not after it has been dropped and bounced back.
              draggingId && !isDroppable(group.key) && overKey !== group.key && "opacity-45",
            )}
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-2.5">
              {group.color ? (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    SELECT_COLOR_CLASSES[group.color],
                  )}
                >
                  {group.label}
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[12px] font-medium",
                    group.key === UNGROUPED_KEY ? "text-faint-foreground" : "text-foreground",
                  )}
                >
                  {group.key === UNGROUPED_KEY ? `No ${groupColumn.name.toLowerCase()}` : group.label}
                </span>
              )}

              <Badge variant="default" className="ml-auto">
                {group.rowIds.length}
              </Badge>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {group.rowIds.slice(0, limits[group.key] ?? CARDS_PER_PAGE).map((rowId) => (
                <RecordCard
                  key={rowId}
                  rowId={rowId}
                  primaryColumnId={board?.primaryColumnId ?? ""}
                  fields={cardFields}
                  context={context}
                  canDrag={canEdit}
                  hierarchy={model.hierarchy}
                  completionColumn={model.completionColumn}
                  onDragStart={setDraggingId}
                  onDragEnd={() => setDraggingId(null)}
                />
              ))}

              {group.rowIds.length > (limits[group.key] ?? CARDS_PER_PAGE) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[11px]"
                  onClick={() =>
                    setLimits((current) => ({
                      ...current,
                      [group.key]: (current[group.key] ?? CARDS_PER_PAGE) + CARDS_PER_PAGE,
                    }))
                  }
                >
                  Show {Math.min(
                    CARDS_PER_PAGE,
                    group.rowIds.length - (limits[group.key] ?? CARDS_PER_PAGE),
                  )}{" "}
                  more of {group.rowIds.length}
                </Button>
              )}

              {group.rowIds.length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] text-faint-foreground">
                  {formatCount(0, "record")}
                </p>
              )}
            </div>

            {canEdit && group.key !== UNGROUPED_KEY && (
              <Button
                size="sm"
                variant="ghost"
                className="m-1 shrink-0 justify-start gap-1.5 text-[12px]"
                onClick={() => {
                  void addRow().then((rowId) => {
                    const value = groupValueFor(groupColumn, group.key);
                    if (rowId && value) {
                      void editCells([{ rowId, columnId: groupColumn.id, value }]);
                    }
                  });
                }}
              >
                <Plus />
                New in {group.label}
              </Button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
