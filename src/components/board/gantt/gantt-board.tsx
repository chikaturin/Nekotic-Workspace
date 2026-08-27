"use client";

import { CalendarOff } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GanttDependencies } from "@/components/board/gantt/gantt-dependencies";
import { GanttGridLayer } from "@/components/board/gantt/gantt-grid-layer";
import { GanttLane } from "@/components/board/gantt/gantt-lane";
import { GanttSetup } from "@/components/board/gantt/gantt-setup";
import { GanttTaskRow } from "@/components/board/gantt/gantt-task-row";
import { GanttTimelineHeader } from "@/components/board/gantt/gantt-timeline-header";
import { GanttToolbar } from "@/components/board/gantt/gantt-toolbar";
import { GanttUnscheduled } from "@/components/board/gantt/gantt-unscheduled";
import { StatePanel } from "@/components/shared/state-panels";
import { MOCK_NOW } from "@/config/app";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { buildGanttLinks, buildGanttRows } from "@/lib/board-gantt";
import { layoutHierarchy } from "@/lib/board-hierarchy";
import { timelineScale } from "@/lib/board-timeline";
import { formatCount } from "@/lib/format";
import { selectCollapsedParents, useGridStore } from "@/store/grid-store";
import { useBoardStore } from "@/store/board-store";
import type { GanttZoom } from "@/types";

const ROW_HEIGHT = 30;
const HEADER_HEIGHT = 44;
const DEFAULT_PANEL_WIDTH = 280;
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 560;

interface GanttBoardProps {
  readonly model: BoardViewModel;
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
 * are driven by one virtual window, so the name on the left is always the bar
 * on the right.
 *
 * The chart is a *view* of the schedule and does not edit it. Dragging a bar to
 * a new date was removed: a chart that rewrites dates on a mouse slip is worse
 * than one that asks you to type them, and the drawer and the grid already have
 * proper date editors. Clicking a bar opens the record, where the dates live.
 *
 * Rendering is layered — background rules, then bars, then connectors — rather
 * than each row drawing its own grid. That is what lets a rule run the whole
 * height of the chart, and it keeps the background's cost tied to the width of
 * the window rather than to the number of records.
 */
export function GanttBoard({ model }: GanttBoardProps) {
  const { board, view, columns, columnsShown, rowIds, dateColumn, endDateColumn, context } = model;

  const rowsById = useBoardStore((state) => state.rowsById);
  const setGanttZoom = useBoardStore((state) => state.setGanttZoom);
  const setShowDependencies = useBoardStore((state) => state.setShowDependencies);

  const collapsed = useGridStore(selectCollapsedParents(view?.id ?? null));
  const toggleParent = useGridStore((state) => state.toggleParent);

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
   * Put today in the middle of the chart. Only the viewport moves — no record's
   * dates are touched by this, or by anything else on this surface.
   */
  const scrollToToday = useCallback(() => {
    const element = scroll.current;
    if (!element) return;

    const centre = scale.todayOffset * scale.dayWidth - (element.clientWidth - panelWidth) / 2;
    element.scrollLeft = Math.max(0, centre);
  }, [scale.todayOffset, scale.dayWidth, panelWidth]);

  /**
   * Open on today, not on whatever the earliest record happens to be. A chart
   * that opens three months in the past makes the reader hunt for the present
   * before they can read anything.
   */
  const hasCentred = useRef(false);
  useLayoutEffect(() => {
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

  // A duration needs both ends. With only one column chosen every record would
  // fall through to Unscheduled, which looks like a broken chart rather than an
  // unfinished setup — so the setup is what gets shown.
  if (!dateColumn || !endDateColumn) {
    return (
      <GanttSetup
        columns={columns}
        startColumnId={view?.dateColumnId ?? null}
        endColumnId={view?.endDateColumnId ?? null}
      />
    );
  }

  const chartWidth = scale.dayCount * scale.dayWidth;
  const bodyHeight = scheduled.length * ROW_HEIGHT;
  const visible = scheduled.slice(range.start, range.end);
  const primaryColumnId = board?.primaryColumnId ?? "";

  const summary = [
    `${dateColumn?.name ?? "—"} → ${endDateColumn?.name ?? "—"}`,
    formatCount(scheduled.length, "bar"),
    unscheduled.length > 0 ? `${unscheduled.length} unscheduled` : null,
    "read-only — dates are edited in the record",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <GanttToolbar
        zoom={zoom}
        onZoomChange={changeZoom}
        showDependencies={showDependencies}
        onToggleDependencies={() => void setShowDependencies(!showDependencies)}
        onToday={scrollToToday}
        summary={summary}
      />

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
                className="sticky left-0 z-10 flex shrink-0 items-end border-r border-hairline bg-elevated px-3 pb-1 text-[11px] font-medium text-muted-foreground"
              >
                Task
              </div>

              <div style={{ width: chartWidth }} className="shrink-0">
                <GanttTimelineHeader scale={scale} height={HEADER_HEIGHT} />
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
                {/* One background for the whole chart, so a rule runs its full
                    height instead of stopping at every row border. */}
                <GanttGridLayer scale={scale} height={bodyHeight} />

                <div style={{ height: range.paddingTop }} aria-hidden />
                {visible.map((row) => (
                  <GanttLane
                    key={row.rowId}
                    row={row}
                    primaryColumnId={primaryColumnId}
                    columns={columnsShown}
                    statusColumn={model.completionColumn}
                    context={context}
                    dayWidth={scale.dayWidth}
                    height={ROW_HEIGHT}
                    hasConflict={conflicted.has(row.rowId)}
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
