"use client";

import type { GanttLink, GanttRow } from "@/lib/board-gantt";
import { connectorPath, connectorPoints } from "@/lib/gantt-connector";

interface GanttDependenciesProps {
  readonly rows: readonly GanttRow[];
  readonly links: readonly GanttLink[];
  readonly dayWidth: number;
  readonly rowHeight: number;
  readonly width: number;
  readonly windowStart: number;
  readonly windowEnd: number;
}

export function GanttDependencies({
  rows,
  links,
  dayWidth,
  rowHeight,
  width,
  windowStart,
  windowEnd,
}: GanttDependenciesProps) {
  const positions = new Map(rows.map((row, index) => [row.rowId, index]));

  const isMounted = (index: number) => index >= windowStart && index < windowEnd;

  const visible = links.filter((link) => {
    const from = positions.get(link.fromRowId);
    const to = positions.get(link.toRowId);
    if (from === undefined || to === undefined) return false;
    return isMounted(from) || isMounted(to);
  });

  if (visible.length === 0) return null;

  return (
    <svg
      aria-hidden
      width={width}
      height={rows.length * rowHeight}
      className="pointer-events-none absolute top-0 left-0 z-base overflow-visible"
    >
      {visible.map((link) => {
        const fromIndex = positions.get(link.fromRowId);
        const toIndex = positions.get(link.toRowId);
        if (fromIndex === undefined || toIndex === undefined) return null;

        const from = rows[fromIndex]?.schedule;
        const to = rows[toIndex]?.schedule;
        if (!from || !to) return null;

        const stroke = link.isConflict ? "var(--warning)" : "var(--border-strong)";

        const x2 = to.offset * dayWidth;
        const y2 = toIndex * rowHeight + rowHeight / 2;

        const path = connectorPath(
          connectorPoints({
            fromStartX: from.offset * dayWidth,
            fromEndX: (from.offset + from.span) * dayWidth,
            fromY: fromIndex * rowHeight + rowHeight / 2,
            toStartX: x2,
            toY: y2,
          }),
        );

        return (
          <g key={`${link.fromRowId}->${link.toRowId}`}>
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={link.isConflict ? 1.5 : 1.25}
              strokeDasharray={link.isConflict ? "3 2" : undefined}
            />
            <path d={`M ${x2} ${y2} l -5 -3.5 l 0 7 z`} fill={stroke} />
          </g>
        );
      })}
    </svg>
  );
}
