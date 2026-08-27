"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useCallback, useMemo, useState, type DragEvent } from "react";
import { CalendarDayDialog } from "@/components/board/views/calendar-day-dialog";
import { RecordCard } from "@/components/board/views/record-card";
import { StatePanel } from "@/components/shared/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_NOW } from "@/config/app";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { buildMonth, moveToDay, shiftMonth } from "@/lib/board-calendar";
import { WEEKDAY_LABELS } from "@/lib/board-dates";
import { cellOf } from "@/lib/cell-values";
import { formatCount } from "@/lib/format";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";

interface CalendarBoardProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

const MAX_CARDS_PER_DAY = 2;

/**
 * Month view over the shared records. Days hold row ids; dropping a card writes
 * the view's date column on the record, so the table updates with it.
 */
export function CalendarBoard({ model, canEdit }: CalendarBoardProps) {
  const { dateColumn, rowIds, columnsShown, context, board } = model;
  const rowsById = useBoardStore((state) => state.rowsById);
  const editCells = useBoardStore((state) => state.editCells);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [monthIso, setMonthIso] = useState(MOCK_NOW);
  const [overKey, setOverKey] = useState<string | null>(null);
  /** The day whose full record list is open — a cell only fits a couple. */
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  const month = useMemo(
    () => (dateColumn ? buildMonth(monthIso, rowIds, rowsById, dateColumn, MOCK_NOW) : null),
    [monthIso, rowIds, rowsById, dateColumn],
  );

  const cardFields = columnsShown.filter(
    (column) => !column.isPrimary && column.id !== dateColumn?.id,
  );

  /** The day the reader asked to see in full, resolved against this month. */
  const openDay = useMemo(() => {
    if (!month || !openDayKey) return null;
    return month.weeks.flat().find((day) => day.key === openDayKey) ?? null;
  }, [month, openDayKey]);

  const drop = useCallback(
    (dayIso: string, rowId: string) => {
      if (!dateColumn) return;

      if (!canEdit) {
        pushFeedback(`You do not have permission to change ${dateColumn.name}`, "error");
        return;
      }

      const row = rowsById[rowId];
      if (!row) return;

      const current = cellOf(row, dateColumn);
      const iso = moveToDay(current.kind === "date" ? current.iso : null, dayIso);

      void editCells([{ rowId, columnId: dateColumn.id, value: { kind: "date", iso } }]);
    },
    [dateColumn, canEdit, rowsById, editCells, pushFeedback],
  );

  if (!dateColumn || !month) {
    return (
      <div className="min-h-0 flex-1 p-6">
        <StatePanel
          icon={CalendarDays}
          title="Pick a date column"
          description="The calendar places records by one Date column. Choose which one under Dates."
        />
      </div>
    );
  }

  function handleDrop(event: DragEvent<HTMLElement>, dayIso: string) {
    event.preventDefault();
    setOverKey(null);
    const rowId = event.dataTransfer.getData("text/plain");
    if (rowId) drop(dayIso, rowId);
  }

  return (
    <div className="flex min-h-0 flex-1 bg-canvas">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => setMonthIso((current) => shiftMonth(current, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next month"
            onClick={() => setMonthIso((current) => shiftMonth(current, 1))}
          >
            <ChevronRight />
          </Button>

          <h2 className="text-[13px] font-semibold text-foreground">{month.label}</h2>

          <Button
            size="sm"
            variant="ghost"
            className="text-[11px]"
            onClick={() => setMonthIso(MOCK_NOW)}
          >
            Today
          </Button>

          <span className="metric ml-auto text-[11px] text-faint-foreground">
            {dateColumn.name} · {formatCount(month.scheduledCount, "record")} in view
          </span>
        </header>

        <div className="grid shrink-0 grid-cols-7 border-b border-hairline">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="metric px-2 py-1 text-[10px] uppercase tracking-wider text-faint-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {month.weeks.flat().map((day) => (
            <div
              key={day.key}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = canEdit ? "move" : "none";
                setOverKey(day.key);
              }}
              onDragLeave={() => setOverKey((key) => (key === day.key ? null : key))}
              onDrop={(event) => handleDrop(event, day.iso)}
              className={cn(
                "flex min-h-24 flex-col gap-1 overflow-hidden border-b border-r border-hairline p-1",
                day.isCurrentMonth ? "bg-background" : "bg-surface/40",
                overKey === day.key && (canEdit ? "bg-accent-soft" : "bg-danger/5"),
              )}
            >
              <div className="flex shrink-0 items-center gap-1">
                {/* The date is the way into the day: it opens every record on
                    it, not just the two the cell had room for. */}
                <button
                  type="button"
                  aria-label={`Open ${day.iso.slice(0, 10)} — ${day.rowIds.length} records`}
                  onClick={() => setOpenDayKey(day.key)}
                  className={cn(
                    "metric flex size-5 items-center justify-center rounded-full text-[10px] transition-colors",
                    day.isToday
                      ? "bg-accent text-accent-foreground"
                      : day.isCurrentMonth
                        ? "text-muted-foreground hover:bg-hover hover:text-foreground"
                        : "text-faint-foreground hover:bg-hover",
                  )}
                >
                  {day.dayOfMonth}
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
              {day.rowIds.slice(0, MAX_CARDS_PER_DAY).map((rowId) => (
                <RecordCard
                  key={rowId}
                  rowId={rowId}
                  primaryColumnId={board?.primaryColumnId ?? ""}
                  fields={cardFields}
                  context={context}
                  canDrag={canEdit}
                  density="compact"
                />
              ))}

              </div>

              {day.rowIds.length > MAX_CARDS_PER_DAY && (
                <button
                  type="button"
                  onClick={() => setOpenDayKey(day.key)}
                  className="metric shrink-0 rounded px-1 text-left text-[10px] text-muted-foreground hover:bg-hover hover:text-foreground"
                >
                  +{day.rowIds.length - MAX_CARDS_PER_DAY} more
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <aside
        aria-label="Unscheduled records"
        className="hidden w-64 shrink-0 flex-col border-l border-border bg-background lg:flex"
      >
        <header className="flex shrink-0 items-center gap-1.5 border-b border-hairline px-3 py-2.5">
          <Inbox className="size-3.5 text-faint-foreground" />
          <h3 className="text-[12px] font-medium text-foreground">Unscheduled</h3>
          <Badge variant="default" className="ml-auto">
            {month.unscheduled.length}
          </Badge>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {month.unscheduled.map((rowId) => (
            <RecordCard
              key={rowId}
              rowId={rowId}
              primaryColumnId={board?.primaryColumnId ?? ""}
              fields={cardFields}
              context={context}
              canDrag={canEdit}
            />
          ))}

          {month.unscheduled.length === 0 && (
            <p className="px-1 py-6 text-center text-[11px] text-faint-foreground">
              Every record in this view has a {dateColumn.name.toLowerCase()}.
            </p>
          )}
        </div>
      </aside>

      <CalendarDayDialog
        day={openDay}
        primaryColumnId={board?.primaryColumnId ?? ""}
        fields={cardFields}
        context={context}
        canDrag={false}
        onClose={() => setOpenDayKey(null)}
      />
    </div>
  );
}
