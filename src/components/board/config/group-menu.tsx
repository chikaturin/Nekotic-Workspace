"use client";

import { Group } from "lucide-react";
import { useId } from "react";
import { CountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { columnVisual } from "@/lib/board-visuals";
import { useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";

/** Columns that produce meaningful buckets. */
const GROUPABLE = new Set(["select", "user", "date", "text"]);

/**
 * Grouping for the table and Kanban. Kanban always groups — its columns are
 * the groups — so the same setting drives both.
 */
export function GroupMenu({ model }: { model: BoardViewModel }) {
  const { view, columns, groups } = model;
  const setGroupBy = useBoardStore((state) => state.setGroupBy);
  const setHideEmptyGroups = useBoardStore((state) => state.setHideEmptyGroups);
  const setCollapsedGroups = useGridStore((state) => state.setCollapsedGroups);

  const candidates = columns.filter((column) => GROUPABLE.has(column.type));
  const isGrouped = Boolean(view?.groupByColumnId);
  const isKanban = view?.type === "kanban";

  // The picker's trigger is a div rather than a control the browser will
  // associate with a wrapping <label>, so the visible caption is pointed at
  // explicitly instead.
  const groupByLabelId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={isGrouped ? "subtle" : "ghost"} className="gap-1.5">
          <Group />
          Group
          {isGrouped && groups && <CountBadge>{groups.length}</CountBadge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <div className="flex items-center gap-2 px-1 py-1">
          <span id={groupByLabelId} className="w-16 shrink-0 text-body text-muted-foreground">
            Group by
          </span>
          {/* The type icon is what distinguishes the four groupable kinds:
              grouping by a date column buckets by day and grouping by a text
              one buckets by exact string, and the names alone never said so.
              Clearing the picker is the old "None" option — same null. */}
          <Select
            aria-labelledby={groupByLabelId}
            size="sm"
            isClearable
            placeholder={isKanban ? "Required for Kanban" : "None"}
            options={candidates.map((column) => ({
              value: column.id,
              label: column.name,
              icon: columnVisual(column.type).Icon,
            }))}
            value={view?.groupByColumnId ?? null}
            onValueChange={(value) => void setGroupBy(value)}
            className="min-w-0 flex-1"
          />
        </div>

        {isGrouped && (
          <>
            <label className="mt-1 flex items-center gap-2 px-1 py-1 text-ui text-muted-foreground">
              <Checkbox
                checked={view?.hideEmptyGroups ?? false}
                disabled={isKanban}
                onChange={(event) => void setHideEmptyGroups(event.target.checked)}
              />
              Hide empty groups
              {isKanban && (
                <span className="text-micro text-faint-foreground">(Kanban keeps them)</span>
              )}
            </label>

            {!isKanban && groups && view && (
              <div className="mt-2 flex gap-1 border-t border-hairline pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-body"
                  onClick={() =>
                    setCollapsedGroups(
                      view.id,
                      groups.map((group) => group.key),
                    )
                  }
                >
                  Collapse all
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-body"
                  onClick={() => setCollapsedGroups(view.id, [])}
                >
                  Expand all
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
