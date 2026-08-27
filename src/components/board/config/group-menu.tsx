"use client";

import { Group } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={isGrouped ? "subtle" : "ghost"} className="gap-1.5">
          <Group />
          Group
          {isGrouped && groups && <Badge variant="count">{groups.length}</Badge>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <label className="flex items-center gap-2 px-1 py-1">
          <span className="w-16 shrink-0 text-body text-muted-foreground">Group by</span>
          <SelectField
            value={view?.groupByColumnId ?? ""}
            onChange={(event) => void setGroupBy(event.target.value || null)}
            className="min-w-0 flex-1"
          >
            <option value="">{isKanban ? "Required for Kanban" : "None"}</option>
            {candidates.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </SelectField>
        </label>

        {isGrouped && (
          <>
            <label className="mt-1 flex items-center gap-2 px-1 py-1 text-ui text-muted-foreground">
              <input
                type="checkbox"
                checked={view?.hideEmptyGroups ?? false}
                disabled={isKanban}
                onChange={(event) => void setHideEmptyGroups(event.target.checked)}
                className="size-3.5 accent-[var(--accent)]"
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
