"use client";

import type { GanttLink, GanttRow } from "@/lib/board-gantt";

interface GanttDependenciesProps {
  /** Only the rows currently mounted — offscreen links are not worth drawing. */
  readonly rows: readonly GanttRow[];
  readonly links: readonly GanttLink[];
  readonly dayWidth: number;
  readonly rowHeight: number;
  readonly width: number;
  /** Index of the first mounted row, so y positions line up with the window. */
  readonly firstIndex: number;
}

/** How far a connector reaches out before it turns. */
const ELBOW = 10;

/**
 * "Blocked by", drawn.
 *
 * A connector runs from the end of the blocker to the start of the record that
 * named it, which is the one thing the relation actually asserts. A conflict —
 * the blocked record starting before its blocker ends — is drawn in warning
 * colour and nothing else happens: the chart reports the clash, it does not
 * reschedule anyone. Deciding what to move is the plan owner's job.
 *
 * Only links between two mounted rows are rendered, so a board with thousands
 * of dependencies costs whatever is on screen and no more.
 */
export function GanttDependencies({
  rows,
  links,
  dayWidth,
  rowHeight,
  width,
  firstIndex,
}: GanttDependenciesProps) {
  const positions = new Map(rows.map((row, index) => [row.rowId, index]));
  const visible = links.filter(
    (link) => positions.has(link.fromRowId) && positions.has(link.toRowId),
  );

  if (visible.length === 0) return null;

  const height = rows.length * rowHeight;

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      style={{ top: firstIndex * rowHeight }}
      className="pointer-events-none absolute left-0 z-10 overflow-visible"
    >
      {visible.map((link) => {
        const fromIndex = positions.get(link.fromRowId);
        const toIndex = positions.get(link.toRowId);
        if (fromIndex === undefined || toIndex === undefined) return null;

        const from = rows[fromIndex]?.schedule;
        const to = rows[toIndex]?.schedule;
        if (!from || !to) return null;

        const x1 = (from.offset + from.span) * dayWidth;
        const y1 = fromIndex * rowHeight + rowHeight / 2;
        const x2 = to.offset * dayWidth;
        const y2 = toIndex * rowHeight + rowHeight / 2;

        // Right, down, then in — an orthogonal elbow reads as a dependency
        // where a diagonal reads as a stray line across the chart.
        const turn = Math.max(x1 + ELBOW, x2 - ELBOW);
        const stroke = link.isConflict ? "var(--warning)" : "var(--border-strong)";

        return (
          <g key={`${link.fromRowId}->${link.toRowId}`}>
            <path
              d={`M ${x1} ${y1} H ${turn} V ${y2} H ${x2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={link.isConflict ? 1.5 : 1}
              strokeDasharray={link.isConflict ? "3 2" : undefined}
            />
            <path
              d={`M ${x2} ${y2} l -4 -3 l 0 6 z`}
              fill={stroke}
            />
          </g>
        );
      })}
    </svg>
  );
}
