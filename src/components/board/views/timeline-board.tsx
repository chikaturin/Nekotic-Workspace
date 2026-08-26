"use client";

import { GanttChartSquare, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";
import { StatePanel } from "@/components/shared/state-panels";
import { MOCK_NOW } from "@/config/app";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { shortDayLabel } from "@/lib/board-dates";
import {
  buildBars,
  offsetToIso,
  orderRange,
  pixelsToDays,
  timelineScale,
  ZOOM_LABELS,
  type TimelineZoom,
} from "@/lib/board-timeline";
import { formatCount } from "@/lib/format";
import { selectRow, useBoardStore } from "@/store/board-store";
import { useGridStore } from "@/store/grid-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { CellEdit } from "@/types";

interface TimelineBoardProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

const ROW_HEIGHT = 36;
const LABEL_WIDTH = 240;
const ZOOMS: readonly TimelineZoom[] = ["day", "week", "month"];

type DragMode = "move" | "start" | "end";

/**
 * Gantt over the shared records.
 *
 * Dragging a bar rewrites the two date cells on the board row — nothing else.
 * The drag itself is drawn by mutating the bar's style, so a 5.000-row chart
 * does not re-render while the pointer is down.
 */
export function TimelineBoard({ model, canEdit }: TimelineBoardProps) {
  const { dateColumn, endDateColumn, rowIds, board } = model;
  const rowsById = useBoardStore((state) => state.rowsById);
  const editCells = useBoardStore((state) => state.editCells);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

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

  const commit = useCallback(
    (rowId: string, startIso: string, endIso: string) => {
      if (!dateColumn && !endDateColumn) return;

      // PRD: a start after its end is swapped, and the user is told.
      const ordered = orderRange(startIso, endIso);
      const edits: CellEdit[] = [];

      if (dateColumn && ordered.start) {
        edits.push({ rowId, columnId: dateColumn.id, value: { kind: "date", iso: ordered.start } });
      }
      if (endDateColumn && ordered.end) {
        edits.push({ rowId, columnId: endDateColumn.id, value: { kind: "date", iso: ordered.end } });
      }
      if (edits.length === 0) return;

      void editCells(edits);

      if (ordered.wasSwapped) {
        pushFeedback("Start was after end — the dates were swapped", "info");
      }
    },
    [dateColumn, endDateColumn, editCells, pushFeedback],
  );

  if (!dateColumn && !endDateColumn) {
    return (
      <div className="min-h-0 flex-1 p-6">
        <StatePanel
          icon={GanttChartSquare}
          title="Pick the start and end dates"
          description="The timeline draws a bar between two Date columns. Choose them under Dates."
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

        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
          {ZOOMS.map((level) => (
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
              zoom={zoom}
              canEdit={canEdit}
              todayOffset={scale.todayOffset}
              onCommit={(startDays, endDays) =>
                commit(
                  bar.rowId,
                  offsetToIso(scale, bar.offset + startDays),
                  offsetToIso(scale, bar.offset + bar.span - 1 + endDays),
                )
              }
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
  readonly zoom: TimelineZoom;
  readonly canEdit: boolean;
  readonly todayOffset: number | null;
  /** Days the start and the end moved, relative to where they were. */
  readonly onCommit: (startDays: number, endDays: number) => void;
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
  zoom,
  canEdit,
  todayOffset,
  onCommit,
}: TimelineRowProps) {
  const row = useBoardStore(selectRow(rowId));
  const barRef = useRef<HTMLDivElement>(null);
  const isOpen = useGridStore((state) => state.drawerRowId === rowId);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  if (!row) return null;

  const title = row.cells[primaryColumnId];
  const label = title && title.kind === "text" ? title.value : "Untitled";

  function beginDrag(event: PointerEvent<HTMLElement>, mode: DragMode) {
    event.preventDefault();
    event.stopPropagation();

    if (!canEdit) {
      pushFeedback("You do not have permission to change these dates", "error");
      return;
    }

    const element = barRef.current;
    const target = event.currentTarget;
    if (!element) return;

    const startX = event.clientX;
    const baseLeft = offset * dayWidth;
    const baseWidth = span * dayWidth;
    let startDays = 0;
    let endDays = 0;

    target.setPointerCapture(event.pointerId);

    const onMove = (move: globalThis.PointerEvent) => {
      const days = pixelsToDays(move.clientX - startX, zoom);

      if (mode === "move") {
        startDays = days;
        endDays = days;
        element.style.left = `${baseLeft + days * dayWidth}px`;
        return;
      }

      if (mode === "start") {
        startDays = Math.min(days, span - 1);
        element.style.left = `${baseLeft + startDays * dayWidth}px`;
        element.style.width = `${baseWidth - startDays * dayWidth}px`;
        return;
      }

      endDays = Math.max(days, -(span - 1));
      element.style.width = `${baseWidth + endDays * dayWidth}px`;
    };

    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);

      // Hand the row back to React; the store is about to re-render it.
      element.style.left = "";
      element.style.width = "";

      if (startDays !== 0 || endDays !== 0) onCommit(startDays, endDays);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

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
          ref={barRef}
          style={{ left: offset * dayWidth, width: span * dayWidth }}
          onPointerDown={(event) => beginDrag(event, "move")}
          onClick={() => useGridStore.getState().openDrawer(rowId)}
          role="button"
          tabIndex={0}
          aria-label={`${row.displayId} timeline bar`}
          onKeyDown={(event) => {
            if (event.key === "Enter") useGridStore.getState().openDrawer(rowId);
          }}
          className={cn(
            "group/bar absolute top-1.5 flex h-6 min-w-4 items-center rounded-md border px-1.5",
            canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            isPartial
              ? "border-dashed border-warning/60 bg-warning/15"
              : "border-accent/40 bg-accent/20",
            isOpen && "ring-1 ring-accent",
          )}
        >
          {canEdit && (
            <span
              role="separator"
              aria-label="Resize start"
              onPointerDown={(event) => beginDrag(event, "start")}
              className="absolute -left-0.5 top-0 h-full w-2 cursor-col-resize rounded-l opacity-0 hover:bg-accent/50 group-hover/bar:opacity-100"
            />
          )}

          <span className="metric truncate text-[10px] text-foreground">
            {isPartial && <TriangleAlert className="mr-1 inline size-2.5 text-warning" />}
            {span > 1 ? `${shortDayLabel(startIso)} → ${shortDayLabel(endIso)}` : shortDayLabel(startIso)}
          </span>

          {canEdit && (
            <span
              role="separator"
              aria-label="Resize end"
              onPointerDown={(event) => beginDrag(event, "end")}
              className="absolute -right-0.5 top-0 h-full w-2 cursor-col-resize rounded-r opacity-0 hover:bg-accent/50 group-hover/bar:opacity-100"
            />
          )}
        </div>
      </div>
    </div>
  );
}
