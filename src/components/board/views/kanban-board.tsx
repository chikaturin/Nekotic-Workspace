"use client";

import { Lock, Plus, Workflow } from "lucide-react";
import { useCallback, useMemo, useState, type DragEvent } from "react";
import { RecordCard } from "@/components/board/views/record-card";
import { StatePanel } from "@/components/shared/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { groupValueFor, UNGROUPED_KEY, type RowGroup } from "@/lib/board-grouping";
import { allowedTargets, evaluateTransition, transitionKeyOf } from "@/lib/transition-rules";
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
 *
 * Dragging is deliberately never blocked. A card can be picked up and carried
 * anywhere, because a drag that dies under the cursor with no explanation is
 * worse than one that is refused out loud: the drop is what gets validated,
 * and a refusal nudges the card and says why. The card never visits the
 * column it was refused from, so there is no flicker to undo either.
 */
export function KanbanBoard({ model, canEdit }: KanbanBoardProps) {
  const { groupColumn, groups, columnsShown, context, board } = model;
  const editCells = useBoardStore((state) => state.editCells);
  const addRow = useBoardStore((state) => state.addRow);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  /** The card a rule just turned away — nudged once so the toast has a subject. */
  const [refusedId, setRefusedId] = useState<string | null>(null);
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
   * Either refusal returns before the optimistic write, so no request is made
   * and the board record is untouched.
   */
  const drop = useCallback(
    (group: RowGroup, rowId: string) => {
      if (!groupColumn) return;

      if (!canEdit) {
        setRefusedId(rowId);
        pushFeedback(`You do not have permission to change ${groupColumn.name}`, "error");
        return;
      }

      if (groupColumn.type === "select") {
        const from = transitionKeyOf(groupKeyOf(rowId, rowsById, groupColumn));
        const verdict = evaluateTransition(groupColumn, from, transitionKeyOf(group.key));

        if (!verdict.isAllowed) {
          setRefusedId(rowId);
          pushFeedback(verdict.reason ?? "That status change is not allowed", "error");
          return;
        }
      }

      const value = groupValueFor(groupColumn, group.key);
      if (!value) return;

      // Optimistic: the store writes the record, then reconciles or reverts on
      // its own if the service refuses. Nothing here refetches the board.
      void editCells([{ rowId, columnId: groupColumn.id, value }]);
    },
    [groupColumn, canEdit, editCells, pushFeedback, rowsById],
  );

  /**
   * Which columns the card being dragged may land in — resolved once, when the
   * drag starts, so hovering a column is a set lookup rather than a rule
   * evaluation, and never a request.
   */
  const reachable = useMemo<ReadonlySet<string> | null>(() => {
    if (!draggingId || !groupColumn || groupColumn.type !== "select") return null;
    if (!groupColumn.config.transitionRules?.enabled) return null;

    const from = transitionKeyOf(groupKeyOf(draggingId, rowsById, groupColumn));
    return new Set(allowedTargets(groupColumn, from));
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

  const isDragging = draggingId !== null;

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-canvas">
      <div className="flex h-full min-w-max items-stretch gap-3 p-3">
        {groups.map((group) => {
          const isOver = overKey === group.key && isDragging;
          const canLand = isDroppable(group.key);

          return (
            <section
              key={group.key}
              aria-label={group.label}
              // Always a valid drop target while the user may edit: refusing
              // the drop outright would swallow the drop event, and with it
              // the explanation the reader needs.
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = canEdit ? "move" : "none";
                setOverKey(group.key);
              }}
              // dragleave also fires when the pointer crosses into a child, so
              // the column only lets go once the pointer is genuinely outside.
              onDragLeave={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && event.currentTarget.contains(next)) return;
                setOverKey((key) => (key === group.key ? null : key));
              }}
              onDrop={(event) => handleDrop(event, group)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-background/60 transition-[opacity,border-color,background-color] duration-150",
                "border-border",
                // While a card is in the air: valid targets lift gently, ones a
                // rule rules out fade back. Two states, no colour wash.
                isDragging && canLand && "border-dashed border-accent/40",
                isDragging && !canLand && "is-dragging",
                isOver && canLand && "border-solid border-accent bg-accent-soft",
                isOver && !canLand && "border-solid border-danger/50 bg-danger/5 opacity-100",
              )}
            >
              <header className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-2.5">
                {group.color ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-body font-medium",
                      SELECT_COLOR_CLASSES[group.color],
                    )}
                  >
                    {group.label}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-ui font-medium",
                      group.key === UNGROUPED_KEY ? "text-faint-foreground" : "text-foreground",
                    )}
                  >
                    {group.key === UNGROUPED_KEY
                      ? `No ${groupColumn.name.toLowerCase()}`
                      : group.label}
                  </span>
                )}

                {isDragging && !canLand ? (
                  <span
                    className="ml-auto flex items-center gap-1 text-micro text-faint-foreground"
                    title="A transition rule does not allow this move"
                  >
                    <Workflow className="size-3" />
                    not from here
                  </span>
                ) : (
                  <Badge variant="default" className="ml-auto">
                    {group.rowIds.length}
                  </Badge>
                )}
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {group.rowIds.slice(0, limits[group.key] ?? CARDS_PER_PAGE).map((rowId) => (
                  <div
                    key={rowId}
                    className={cn(refusedId === rowId && "animate-nudge")}
                    onAnimationEnd={() => setRefusedId((id) => (id === rowId ? null : id))}
                  >
                    <RecordCard
                      rowId={rowId}
                      primaryColumnId={board?.primaryColumnId ?? ""}
                      fields={cardFields}
                      context={context}
                      canDrag={canEdit}
                      hierarchy={model.hierarchy}
                      completionColumn={model.completionColumn}
                      onDragStart={setDraggingId}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverKey(null);
                      }}
                    />
                  </div>
                ))}

                {group.rowIds.length > (limits[group.key] ?? CARDS_PER_PAGE) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-body"
                    onClick={() =>
                      setLimits((current) => ({
                        ...current,
                        [group.key]: (current[group.key] ?? CARDS_PER_PAGE) + CARDS_PER_PAGE,
                      }))
                    }
                  >
                    Show{" "}
                    {Math.min(
                      CARDS_PER_PAGE,
                      group.rowIds.length - (limits[group.key] ?? CARDS_PER_PAGE),
                    )}{" "}
                    more of {group.rowIds.length}
                  </Button>
                )}

                {group.rowIds.length === 0 && (
                  <p className="px-1 py-4 text-center text-body text-faint-foreground">
                    {formatCount(0, "record")}
                  </p>
                )}
              </div>

              {canEdit && group.key !== UNGROUPED_KEY && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="m-1 shrink-0 justify-start gap-1.5 text-ui"
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
          );
        })}
      </div>
    </div>
  );
}
