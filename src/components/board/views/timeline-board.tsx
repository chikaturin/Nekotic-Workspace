"use client";

import { GanttChartSquare, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { StatePanel } from "@/components/shared/state-panels";
import { MOCK_NOW } from "@/config/app";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { shortDayLabel } from "@/lib/board-dates";
import { buildBars, timelineScale, TIMELINE_ZOOMS, ZOOM_LABELS, type TimelineZoom } from "@/lib/board-timeline";
import { formatCount } from "@/lib/format";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { cn } from "@/lib/utils";

interface TimelineBoardProps {
  readonly model: BoardViewModel;
}

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 240;

/**
 * Roadmap over the shared records.
 *
 * Read-only by construction: a bar shows a record's start and end, and that is
 * all it does. Dates are changed where dates are edited — the date cell in the
 * table or the field in the drawer — so a roadmap can be scrolled and scanned
 * without any risk of nudging a deadline by a day. Clicking a bar opens the
 * record's drawer, which is where a change belongs.
 *
 * Two scales, day and week, because those are the granularities a roadmap is
 * planned at.
 */
export function TimelineBoard({ model }: TimelineBoardProps) {
  const { dateColumn, endDateColumn, rowIds, board } = model;
  const rowsById = useBoardStore((state) => state.rowsById);

  const [zoom, setZoom] = useState<TimelineZoom>("week");

  const scale = useMemo(
    () => timelineScale(rowIds, rowsById, dateColumn, endDateColumn, zoom, MOCK_NOW),
    [rowIds, rowsById, dateColumn, endDateColumn, zoom],
  );

  const bars = useMemo(
    () => buildBars(rowIds, rowsById, dateColumn, endDateColumn, scale.startIso),
    [rowIds, rowsById, dateColumn, endDateColumn, scale.startIso],
  );

  const { scrollRef, range, onScroll } = useVirtualRows({
    count: bars.length,
    rowHeight: ROW_HEIGHT,
  });

  if (!dateColumn && !endDateColumn) {
    return (
      <div className="min-h-0 flex-1 p-6">
        <StatePanel
          icon={GanttChartSquare}
          title="Pick the start and end dates"
          description="The roadmap draws a bar between two Date columns. Choose them under Dates."
        />
      </div>
    );
  }

  const chartWidth = scale.dayCount * scale.dayWidth;
  const undated = rowIds.length - bars.length;
  const visible = bars.slice(range.start, range.end);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="metric text-[11px] text-faint-foreground">
          {dateColumn?.name ?? "—"} → {endDateColumn?.name ?? "—"} ·{" "}
          {formatCount(bars.length, "bar")}
          {undated > 0 && ` · ${undated} without dates`}
        </span>

        <span className="metric hidden text-[11px] text-faint-foreground sm:inline">
          · read-only — edit dates on the record
        </span>

        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
          {TIMELINE_ZOOMS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={zoom === level}
              onClick={() => setZoom(level)}
              className={cn(
                "rounded px-2 py-1 text-[11px] transition-colors",
                zoom === level
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ZOOM_LABELS[level]}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
        <div className="w-max min-w-full">
          <div className="sticky top-0 z-30 flex w-max border-b border-border bg-elevated">
            <div
              style={{ width: LABEL_WIDTH }}
              className="sticky left-0 z-10 shrink-0 border-r border-hairline bg-elevated px-3 py-1.5 text-[11px] font-medium text-muted-foreground"
            >
              Record
            </div>

            <div style={{ width: chartWidth }} className="relative h-8 shrink-0">
              {scale.ticks.map((tick) => (
                <div
                  key={tick.iso}
                  style={{ left: tick.offset * scale.dayWidth }}
                  className={cn(
                    "absolute top-0 h-full border-l pl-1 pt-1.5 text-[10px] whitespace-nowrap",
                    tick.isMajor
                      ? "border-border text-foreground"
                      : "border-hairline text-faint-foreground",
                  )}
                >
                  {tick.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: range.paddingTop }} aria-hidden />

          {visible.map((bar) => (
            <TimelineRow
              key={bar.rowId}
              rowId={bar.rowId}
              primaryColumnId={board?.primaryColumnId ?? ""}
              offset={bar.offset}
              span={bar.span}
              startIso={bar.startIso}
              endIso={bar.endIso}
              isPartial={bar.isPartial}
              dayWidth={scale.dayWidth}
              chartWidth={chartWidth}
              todayOffset={scale.todayOffset}
            />
          ))}

          <div style={{ height: range.paddingBottom }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

interface TimelineRowProps {
  readonly rowId: string;
  readonly primaryColumnId: string;
  readonly offset: number;
  readonly span: number;
  readonly startIso: string;
  readonly endIso: string;
  readonly isPartial: boolean;
  readonly dayWidth: number;
  readonly chartWidth: number;
  readonly todayOffset: number | null;
}

function TimelineRow({
  rowId,
  primaryColumnId,
  offset,
  span,
  startIso,
  endIso,
  isPartial,
  dayWidth,
  chartWidth,
  todayOffset,
}: TimelineRowProps) {
  const row = useBoardStore(selectRow(rowId));
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);

  if (!row) return null;

  const title = row.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "Untitled";

  return (
    <div style={{ height: ROW_HEIGHT }} className="flex w-max border-b border-hairline">
      <button
        type="button"
        style={{ width: LABEL_WIDTH }}
        onClick={() => useGridStore.getState().openDrawer(rowId)}
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-hairline px-3 text-left",
          isOpen ? "bg-accent-soft" : "bg-background hover:bg-hover",
        )}
      >
        <span className="metric shrink-0 text-[10px] text-faint-foreground">{row.displayId}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{label}</span>
      </button>

      <div style={{ width: chartWidth }} className="relative shrink-0">
        {todayOffset !== null && (
          <div
            aria-hidden
            style={{ left: todayOffset * dayWidth }}
            className="absolute inset-y-0 w-px bg-accent/40"
          />
        )}

        <div
          style={{ left: offset * dayWidth, width: span * dayWidth }}
          onClick={() => useGridStore.getState().openDrawer(rowId)}
          role="button"
          tabIndex={0}
          aria-label={`${row.displayId} ${shortDayLabel(startIso)} to ${shortDayLabel(endIso)} — open record`}
          onKeyDown={(event) => {
            if (event.key === "Enter") useGridStore.getState().openDrawer(rowId);
          }}
          className={cn(
            "absolute top-1.5 flex h-6 min-w-4 cursor-pointer items-center rounded-md border px-1.5",
            isPartial
              ? "border-dashed border-warning/60 bg-warning/15"
              : "border-accent/40 bg-accent/20",
            isOpen && "ring-1 ring-accent",
          )}
        >
          <span className="metric truncate text-[10px] text-foreground">
            {isPartial && <TriangleAlert className="mr-1 inline size-2.5 text-warning" />}
            {span > 1 ? `${shortDayLabel(startIso)} → ${shortDayLabel(endIso)}` : shortDayLabel(startIso)}
          </span>
        </div>
      </div>
    </div>
  );
}
