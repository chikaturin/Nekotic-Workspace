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
import { buildGanttLinks, buildGanttRows, fillScheduleEdits, type GanttRow } from "@/lib/board-gantt";
import { layoutHierarchy } from "@/lib/board-hierarchy";
import { normalizeGanttZoom, timelineScale } from "@/lib/board-timeline";
import { formatCount } from "@/lib/format";
import { selectCollapsedParents, useGridStore } from "@/store/grid-store";
import { useBoardStore } from "@/store/board-store";
import type { GanttZoom } from "@/types";

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 44;
const DEFAULT_PANEL_WIDTH = 280;
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 560;

interface GanttBoardProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

export function GanttBoard({ model, canEdit }: GanttBoardProps) {
  const { board, view, columns, columnsShown, rowIds, dateColumn, endDateColumn, context } = model;

  const rowsById = useBoardStore((state) => state.rowsById);
  const editCells = useBoardStore((state) => state.editCells);
  const setGanttZoom = useBoardStore((state) => state.setGanttZoom);
  const setShowDependencies = useBoardStore((state) => state.setShowDependencies);

  const collapsed = useGridStore(selectCollapsedParents(view?.id ?? null));
  const toggleParent = useGridStore((state) => state.toggleParent);

  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const scroll = useRef<HTMLDivElement>(null);
  const anchorDay = useRef<number | null>(null);

  const zoom: GanttZoom = normalizeGanttZoom(view?.ganttZoom);
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

  const allLinks = useMemo(
    () => buildGanttLinks(scheduled, rowsById, columns),
    [scheduled, rowsById, columns],
  );

  const links = useMemo(
    () => (showDependencies ? allLinks : []),
    [showDependencies, allLinks],
  );

  const conflicted = useMemo(
    () => new Set(links.filter((link) => link.isConflict).map((link) => link.toRowId)),
    [links],
  );

  const { scrollRef, range, onScroll } = useVirtualRows({
    count: scheduled.length,
    rowHeight: ROW_HEIGHT,
  });

  const scrollToToday = useCallback(() => {
    const element = scroll.current;
    if (!element) return;

    const centre = scale.todayOffset * scale.dayWidth - (element.clientWidth - panelWidth) / 2;
    element.scrollLeft = Math.max(0, centre);
  }, [scale.todayOffset, scale.dayWidth, panelWidth]);

  const hasCentred = useRef(false);
  useLayoutEffect(() => {
    if (hasCentred.current || scheduled.length === 0) return;
    hasCentred.current = true;
    scrollToToday();
  }, [scheduled.length, scrollToToday]);

  const fillDates = useCallback(
    (targets: readonly GanttRow[]) => {
      const edits = fillScheduleEdits(targets, rowsById, dateColumn, endDateColumn, MOCK_NOW);
      if (edits.length > 0) void editCells(edits);
    },
    [rowsById, dateColumn, endDateColumn, editCells],
  );

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
        linkCount={allLinks.length}
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
            <div
              style={{ height: HEADER_HEIGHT }}
              className="sticky top-0 z-sticky flex border-b border-border bg-elevated"
            >
              <div
                style={{ width: panelWidth }}
                className="sticky left-0 z-sticky flex shrink-0 items-end border-r border-hairline bg-elevated px-3 pb-1 text-body font-medium text-muted-foreground"
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
                className="sticky left-0 z-sticky shrink-0 border-r border-hairline bg-background"
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
                <GanttGridLayer scale={scale} height={bodyHeight} />

                {showDependencies && (
                  <GanttDependencies
                    rows={scheduled}
                    links={links}
                    dayWidth={scale.dayWidth}
                    rowHeight={ROW_HEIGHT}
                    width={chartWidth}
                    windowStart={range.start}
                    windowEnd={range.end}
                  />
                )}

                <div className="relative z-raised">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <GanttUnscheduled
        rows={unscheduled}
        primaryColumnId={primaryColumnId}
        canEdit={canEdit}
        onFill={fillDates}
      />
    </div>
  );
}

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
      className="sticky z-sticky -ml-1 w-2 shrink-0 cursor-col-resize touch-none"
      style={{ left: width - 4 }}
    />
  );
}
