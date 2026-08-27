"use client";

import { ListTree, Workflow, X } from "lucide-react";
import { useState } from "react";
import { DateMenu } from "@/components/board/config/date-menu";
import { FilterMenu } from "@/components/board/config/filter-menu";
import { GroupMenu } from "@/components/board/config/group-menu";
import { SelectColumnDialog } from "@/components/board/config/select-column-dialog";
import { SortMenu } from "@/components/board/config/sort-menu";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { describeFilter } from "@/lib/board-filters";
import { SUBTASK_DISPLAY_LABELS } from "@/lib/board-hierarchy";
import { useBoardStore } from "@/store/board-store";
import type { PermissionResolver, RowHeight, SubtaskDisplay } from "@/types";

const ROW_HEIGHTS: readonly RowHeight[] = ["short", "medium", "tall"];
const SUBTASK_DISPLAYS: readonly SubtaskDisplay[] = ["nested", "flat", "hidden"];

/**
 * The bar's own step, shared with the menus it opens. Both selects here are
 * fixed lists of plain words, so they stay native — there is no icon, colour
 * or avatar for an option to carry, and the platform's keyboard is free.
 */
const CONTROL_SIZE = "sm" as const;

/**
 * One configuration bar for every view type. Filter, sort and group are shared
 * by all four; the date anchors only appear where they mean something.
 *
 * Filter, sort, group and row height are how anybody *reads* a board, so they
 * are open to everybody. Transition rules are not: they decide what every card
 * on the board is allowed to do, and the button that opens them is gated on the
 * same key the column header's own menu checks.
 */
export function ViewConfigBar({
  model,
  can,
}: {
  readonly model: BoardViewModel;
  readonly can: PermissionResolver;
}) {
  const { view, columns, groupColumn, subtaskDisplay } = model;
  const setFilters = useBoardStore((state) => state.setFilters);
  const setRowHeight = useBoardStore((state) => state.setRowHeight);
  const setSubtaskDisplay = useBoardStore((state) => state.setSubtaskDisplay);
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const people = useBoardStore((state) => state.people);

  const [isEditingRules, setIsEditingRules] = useState(false);

  const needsDates = view?.type === "calendar" || view?.type === "gantt";
  const filters = view?.filters ?? [];

  /**
   * Kanban writes the group column on every drop, so its transition rules are
   * worth reaching from the board itself — the same dialog the column header
   * opens, and the same stored config.
   */
  const kanbanStatusColumn =
    view?.type === "kanban" && groupColumn?.type === "select" ? groupColumn : null;

  // Reading the workflow is how you understand a refused drag, so the button
  // stays for everyone; what it opens is read-only below Manager.
  const canEditRules = can("board.column.update");

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-hairline px-3 py-1.5">
      <FilterMenu model={model} />
      <SortMenu model={model} />
      {!needsDates && <GroupMenu model={model} />}
      {needsDates && <DateMenu model={model} />}

      {kanbanStatusColumn && (
        <Button
          size="sm"
          variant={kanbanStatusColumn.config.transitionRules?.enabled ? "subtle" : "ghost"}
          className="gap-1.5"
          onClick={() => setIsEditingRules(true)}
        >
          <Workflow />
          Transition rules
          {!canEditRules && <span className="sr-only"> (read only)</span>}
        </Button>
      )}

      {/* Hierarchy is presentation, so it lives on the view like row height —
          one saved view can nest subtasks while another lists them flat. */}
      <label className="ml-1 flex items-center gap-1">
        <ListTree className="size-3.5 shrink-0 text-faint-foreground" />
        <span className="sr-only">Subtasks</span>
        <SelectField
          aria-label="Subtasks"
          size={CONTROL_SIZE}
          value={subtaskDisplay}
          onChange={(event) => void setSubtaskDisplay(event.target.value as SubtaskDisplay)}
        >
          {SUBTASK_DISPLAYS.map((display) => (
            <option key={display} value={display}>
              {SUBTASK_DISPLAY_LABELS[display]}
            </option>
          ))}
        </SelectField>
      </label>

      {view?.type === "table" && (
        <SelectField
          aria-label="Row height"
          size={CONTROL_SIZE}
          value={view.rowHeight}
          onChange={(event) => void setRowHeight(event.target.value as RowHeight)}
          className="ml-1"
        >
          {ROW_HEIGHTS.map((height) => (
            <option key={height} value={height}>
              {height[0]?.toUpperCase()}
              {height.slice(1)} rows
            </option>
          ))}
        </SelectField>
      )}

      {filters.length > 0 && (
        <div className="ml-2 flex min-w-0 flex-wrap items-center gap-1">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => void setFilters(filters.filter((item) => item.id !== filter.id))}
              className="group flex max-w-56 items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-body text-accent"
            >
              <span className="truncate">{describeFilter(filter, columns)}</span>
              {/* A faded glyph is how the system spells a state — disabled,
                  pending, frozen — and this one is in none of them. It is
                  simply quieter than the label beside it, which is a colour,
                  and it brightens with the pill rather than only under its
                  own two pixels. */}
              <X
                aria-hidden="true"
                className="size-2.5 shrink-0 text-faint-foreground transition-colors group-hover:text-foreground"
              />
            </button>
          ))}

          <Button size="xs" variant="ghost" onClick={() => void setFilters([])}>
            Clear all
          </Button>
        </div>
      )}

      <SelectColumnDialog
        column={isEditingRules ? kanbanStatusColumn : null}
        columns={columns}
        people={people}
        canEdit={canEditRules}
        onClose={() => setIsEditingRules(false)}
        onSave={(config) => {
          if (kanbanStatusColumn) void updateColumnConfig(kanbanStatusColumn.id, { config });
        }}
      />
    </div>
  );
}
