"use client";

import { CalendarOff } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GanttDependencies } from "@/components/board/gantt/gantt-dependencies";
import { GanttLane } from "@/components/board/gantt/gantt-lane";
import { GanttSetup } from "@/components/board/gantt/gantt-setup";
import { GanttTaskRow } from "@/components/board/gantt/gantt-task-row";
import { GanttToolbar } from "@/components/board/gantt/gantt-toolbar";
import { GanttUnscheduled } from "@/components/board/gantt/gantt-unscheduled";
import { StatePanel } from "@/components/shared/state-panels";
import { MOCK_NOW } from "@/config/app";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useGanttDrag } from "@/hooks/use-gantt-drag";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { isWeekend } from "@/lib/board-dates";
import { buildGanttLinks, buildGanttRows } from "@/lib/board-gantt";
import { layoutHierarchy } from "@/lib/board-hierarchy";
import { timelineScale } from "@/lib/board-timeline";
import { formatCount } from "@/lib/format";
import { addDays } from "@/lib/board-dates";
import { selectCollapsedParents, useGridStore } from "@/store/grid-store";
import { useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import type { GanttZoom } from "@/types";

const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 32;
const DEFAULT_PANEL_WIDTH = 268;
const MIN_PANEL_WIDTH = 160;
const MAX_PANEL_WIDTH = 520;
/** Below this a weekend stripe is thinner than its own border. */
const WEEKEND_MIN_DAY_WIDTH = 12;

interface GanttBoardProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

/**
 * Gantt over the shared board records.
 *
 * There is no Gantt data source. The rows are the same ids every other view
 * renders, nested by the same hierarchy the table nests with, filtered and
 * sorted by the same engine — so a date changed here is a cell written on the
 * record, and the table, the drawer and the calendar have it on the next frame.
 *
 * Two structures sit side by side: a task panel that stays put while the chart
 * scrolls sideways, and a chart whose lanes line up with it row for row. Both
 * mount only what is on screen.
 */
export function GanttBoard({ model, canEdit }: GanttBoardProps) {
  const { board, view, columns, columnsShown, rowIds, dateColumn, endDateColumn, context } = model;

  const rowsById = useBoardStore((state) => state.rowsById);
  const editCells = useBoardStore((state) => state.editCells);
  const setGanttZoom = useBoardStore((state) => state.setGanttZoom);
  const setShowDependencies = useBoardStore((state) => state.setShowDependencies);

  const collapsed = useGridStore(selectCollapsedParents(view?.id ?? null));
  const toggleParent = useGridStore((state) => state.toggleParent);
  const openDrawer = useGridStore((state) => state.openDrawer);

  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const scroll = useRef<HTMLDivElement>(null);
  /** The day to keep under the middle of the viewport across a zoom change. */
  const anchorDay = useRef<number | null>(null);

  const zoom: GanttZoom = view?.ganttZoom ?? "week";
  const showDependencies = view?.showDependencies ?? true;

  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const entries = useMemo(
    () =>
      layoutHierarchy({
        rowIds,
        rowsById,
        index: model.hierarchy,
        display: model.subtaskDisplay,
        collapsed: collapsedSet,
      }),
    [rowIds, rowsById, model.hierarchy, model.subtaskDisplay, collapsedSet],
  );

  const scale = useMemo(
    () => timelineScale(rowIds, rowsById, dateColumn, endDateColumn, zoom, MOCK_NOW),
    [rowIds, rowsById, dateColumn, endDateColumn, zoom],
  );

  const { scheduled, unscheduled } = useMemo(
    () =>
      buildGanttRows({
        entries,
        rowsById,
        index: model.hierarchy,
        startColumn: dateColumn,
        endColumn: endDateColumn,
        completionColumn: model.completionColumn,
        rangeStartIso: scale.startIso,
      }),
    [entries, rowsById, model.hierarchy, dateColumn, endDateColumn, model.completionColumn, scale.startIso],
  );

  const links = useMemo(
    () => (showDependencies ? buildGanttLinks(scheduled, rowsById, columns) : []),
    [showDependencies, scheduled, rowsById, columns],
  );

  /** Rows whose start falls before something they are blocked by finishes. */
  const conflicted = useMemo(
    () => new Set(links.filter((link) => link.isConflict).map((link) => link.toRowId)),
    [links],
  );

  const { scrollRef, range, onScroll } = useVirtualRows({
    count: scheduled.length,
    rowHeight: ROW_HEIGHT,
  });

  /**
   * A date written from the chart is an ordinary cell edit, so it takes the
   * same optimistic path — and the same rollback — as one typed in the table.
   * Nothing here knows about transition rules: those govern Status, not dates.
   */
  const commit = useCallback(
    (rowId: string, next: { startIso: string; endIso: string }) => {
      const edits = [];
      if (dateColumn) {
        edits.push({
          rowId,
          columnId: dateColumn.id,
          value: { kind: "date" as const, iso: next.startIso },
        });
      }
      if (endDateColumn) {
        edits.push({
          rowId,
          columnId: endDateColumn.id,
          value: { kind: "date" as const, iso: next.endIso },
        });
      }

      if (edits.length > 0) void editCells(edits);
    },
    [dateColumn, endDateColumn, editCells],
  );

  const drag = useGanttDrag({
    dayWidth: scale.dayWidth,
    canEdit,
    onCommit: commit,
    onClick: openDrawer,
  });

  const scrollToToday = useCallback(() => {
    const element = scroll.current;
    if (!element || scale.todayOffset === null) return;

    element.scrollLeft =
      scale.todayOffset * scale.dayWidth - (element.clientWidth - panelWidth) / 2;
  }, [scale.todayOffset, scale.dayWidth, panelWidth]);

  /** Open on today rather than on whatever the earliest record happens to be. */
  const hasCentred = useRef(false);
  useEffect(() => {
    if (hasCentred.current || scheduled.length === 0) return;
    hasCentred.current = true;
    scrollToToday();
  }, [scheduled.length, scrollToToday]);

  /**
   * Zoom keeps its place. Without this, every scale change scrolls back to the
   * start of the project and the reader loses whatever they were looking at.
   */
  function changeZoom(next: GanttZoom) {
    const element = scroll.current;
    if (element) {
      const centre = element.scrollLeft + (element.clientWidth - panelWidth) / 2;
      anchorDay.current = centre / scale.dayWidth;
    }
    void setGanttZoom(next);
  }

  useLayoutEffect(() => {
    const element = scroll.current;
    const day = anchorDay.current;
    if (!element || day === null) return;

    anchorDay.current = null;
    element.scrollLeft = day * scale.dayWidth - (element.clientWidth - panelWidth) / 2;
  }, [scale.dayWidth, panelWidth]);

  if (!dateColumn && !endDateColumn) {
    return (
      <GanttSetup
        columns={columns}
        startColumnId={view?.dateColumnId ?? null}
        endColumnId={view?.endDateColumnId ?? null}
      />
    );
  }

  const chartWidth = scale.dayCount * scale.dayWidth;
  const visible = scheduled.slice(range.start, range.end);
  const primaryColumnId = board?.primaryColumnId ?? "";

  const summary = [
    `${dateColumn?.name ?? "—"} → ${endDateColumn?.name ?? "—"}`,
    formatCount(scheduled.length, "bar"),
    unscheduled.length > 0 ? `${unscheduled.length} unscheduled` : null,
    canEdit ? null : "read-only",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // `relative` so the drag label anchors to the chart, not to the page.
    <div className="relative flex min-h-0 flex-1 flex-col bg-canvas">
      <GanttToolbar
        zoom={zoom}
        onZoomChange={changeZoom}
        showDependencies={showDependencies}
        onToggleDependencies={() => void setShowDependencies(!showDependencies)}
        onToday={scrollToToday}
        hasToday={scale.todayOffset !== null}
        summary={summary}
      />

      {drag.preview && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-50 -translate-x-1/2 rounded-md border border-border bg-elevated px-2 py-1 shadow-lg">
          <span className="metric text-[11px] text-foreground">
            {drag.preview.mode === "resize-end"
              ? `End: ${drag.preview.endIso.slice(0, 10)}`
              : drag.preview.mode === "resize-start"
                ? `Start: ${drag.preview.startIso.slice(0, 10)}`
                : `${drag.preview.startIso.slice(0, 10)} → ${drag.preview.endIso.slice(0, 10)}`}
          </span>
        </div>
      )}

      {scheduled.length === 0 && unscheduled.length === 0 ? (
        <div className="min-h-0 flex-1 p-6">
          <StatePanel
            icon={CalendarOff}
            title="No scheduled records yet"
            description={`Give a record a ${dateColumn?.name ?? "start"} and it appears here.`}
          />
        </div>
      ) : (
        <div
          ref={(node) => {
            scroll.current = node;
            scrollRef.current = node;
          }}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-auto"
        >
          <div className="w-max min-w-full">
            {/* The date header stays put vertically; the task column stays put
                horizontally. Both have to, or one of them stops being a label. */}
            <div
              style={{ height: HEADER_HEIGHT }}
              className="sticky top-0 z-30 flex border-b border-border bg-elevated"
            >
              <div
                style={{ width: panelWidth }}
                className="sticky left-0 z-10 flex shrink-0 items-center border-r border-hairline bg-elevated px-3 text-[11px] font-medium text-muted-foreground"
              >
                Task
              </div>

              <div style={{ width: chartWidth }} className="relative shrink-0">
                {scale.ticks.map((tick) => (
                  <div
                    key={tick.iso}
                    style={{ left: tick.offset * scale.dayWidth }}
                    className={cn(
                      "absolute top-0 h-full whitespace-nowrap border-l pl-1 pt-1.5 text-[10px]",
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

            <div className="flex">
              <div
                style={{ width: panelWidth }}
                className="sticky left-0 z-20 shrink-0 border-r border-hairline bg-background"
              >
                <div style={{ height: range.paddingTop }} aria-hidden />
                {visible.map((row) => (
                  <GanttTaskRow
                    key={row.rowId}
                    row={row}
                    primaryColumnId={primaryColumnId}
                    height={ROW_HEIGHT}
                    onToggle={(rowId) => toggleParent(view?.id ?? "", rowId)}
                  />
                ))}
                <div style={{ height: range.paddingBottom }} aria-hidden />
              </div>

              <PanelResizer width={panelWidth} onResize={setPanelWidth} />

              <div style={{ width: chartWidth }} className="relative shrink-0">
                {scale.dayWidth >= WEEKEND_MIN_DAY_WIDTH && (
                  <Weekends
                    startIso={scale.startIso}
                    dayCount={scale.dayCount}
                    dayWidth={scale.dayWidth}
                  />
                )}

                {scale.todayOffset !== null && (
                  <div
                    aria-hidden
                    style={{ left: scale.todayOffset * scale.dayWidth }}
                    className="absolute inset-y-0 z-10 w-px bg-accent/50"
                  />
                )}

                <div style={{ height: range.paddingTop }} aria-hidden />
                {visible.map((row) => (
                  <GanttLane
                    key={row.rowId}
                    row={row}
                    primaryColumnId={primaryColumnId}
                    columns={columnsShown}
                    startColumn={dateColumn}
                    endColumn={endDateColumn}
                    statusColumn={model.completionColumn}
                    context={context}
                    dayWidth={scale.dayWidth}
                    height={ROW_HEIGHT}
                    canEdit={canEdit}
                    hasConflict={conflicted.has(row.rowId)}
                    drag={drag}
                  />
                ))}
                <div style={{ height: range.paddingBottom }} aria-hidden />

                {showDependencies && (
                  <GanttDependencies
                    rows={visible}
                    links={links}
                    dayWidth={scale.dayWidth}
                    rowHeight={ROW_HEIGHT}
                    width={chartWidth}
                    firstIndex={range.start}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <GanttUnscheduled rows={unscheduled} primaryColumnId={primaryColumnId} />
    </div>
  );
}

/** Weekend shading — enough to read a week at a glance, not enough to notice. */
function Weekends({
  startIso,
  dayCount,
  dayWidth,
}: {
  readonly startIso: string;
  readonly dayCount: number;
  readonly dayWidth: number;
}) {
  const days: number[] = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    if (isWeekend(addDays(startIso, offset))) days.push(offset);
  }

  return (
    <>
      {days.map((offset) => (
        <div
          key={offset}
          aria-hidden
          style={{ left: offset * dayWidth, width: dayWidth }}
          className="absolute inset-y-0 bg-foreground/[0.03]"
        />
      ))}
    </>
  );
}

/** Drag to trade task-list width for chart width. */
function PanelResizer({
  width,
  onResize,
}: {
  readonly width: number;
  readonly onResize: (width: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the task list"
      onPointerDown={(event) => {
        event.preventDefault();
        const originX = event.clientX;

        const move = (moveEvent: PointerEvent) => {
          const next = width + (moveEvent.clientX - originX);
          onResize(Math.min(Math.max(next, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH));
        };
        const finish = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", finish);
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", finish);
      }}
      className="sticky z-20 -ml-1 w-2 shrink-0 cursor-col-resize touch-none"
      style={{ left: width - 4 }}
    />
  );
}
