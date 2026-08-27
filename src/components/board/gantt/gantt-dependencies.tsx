"use client";

import type { GanttLink, GanttRow } from "@/lib/board-gantt";
import { connectorGutterY, connectorPath, connectorPoints } from "@/lib/gantt-connector";

interface GanttDependenciesProps {
  /** Every scheduled row, so a connector can reach a row that is off-screen. */
  readonly rows: readonly GanttRow[];
  readonly links: readonly GanttLink[];
  readonly dayWidth: number;
  readonly rowHeight: number;
  readonly width: number;
  /** The mounted window, as indexes into `rows`. */
  readonly windowStart: number;
  readonly windowEnd: number;
}

/**
 * "Blocked by", drawn.
 *
 * A connector runs from the end of the blocker to the start of the record that
 * named it, which is the one thing the relation actually asserts. A conflict —
 * the blocked record starting before its blocker ends — is drawn in warning
 * colour and nothing else happens: the chart reports the clash, it does not
 * reschedule anyone. Deciding what to move is the plan owner's job.
 *
 * Routing is in `gantt-connector`, which is where the backwards case is
 * handled: a conflict points leftwards, and running straight back at the
 * target's own height drew the line through the target's bar.
 *
 * A link is drawn when *either* end is on screen. Requiring both meant that
 * scrolling a blocker out of the window silently deleted the arrow pointing at
 * it, which reads as the dependency having disappeared rather than as the row
 * having. Positions come from each row's index in the whole chart, so the line
 * leaves the viewport instead of stopping short of it.
 */
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
      className="pointer-events-none absolute top-0 left-0 z-10 overflow-visible"
    >
      {visible.map((link) => {
        const fromIndex = positions.get(link.fromRowId);
        const toIndex = positions.get(link.toRowId);
        if (fromIndex === undefined || toIndex === undefined) return null;

        const from = rows[fromIndex]?.schedule;
        const to = rows[toIndex]?.schedule;
        if (!from || !to) return null;

        const stroke = link.isConflict ? "var(--warning)" : "var(--border-strong)";

        const path = connectorPath(
          connectorPoints({
            x1: (from.offset + from.span) * dayWidth,
            y1: fromIndex * rowHeight + rowHeight / 2,
            x2: to.offset * dayWidth,
            y2: toIndex * rowHeight + rowHeight / 2,
            gutterY: connectorGutterY(fromIndex, toIndex, rowHeight),
          }),
        );

        const x2 = to.offset * dayWidth;
        const y2 = toIndex * rowHeight + rowHeight / 2;

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
