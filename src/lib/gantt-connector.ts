/**
 * Where a "blocked by" connector runs.
 *
 * Kept out of the component and free of any drawing so the route can be
 * reasoned about — and tested — as geometry, which is all it is.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** How far a connector reaches out of a bar before it turns. */
export const CONNECTOR_ELBOW = 10;

/** How far inside the row boundary the sideways run sits. */
const GUTTER_INSET = 4;

export interface ConnectorInput {
  /** The blocker's finish. */
  readonly x1: number;
  readonly y1: number;
  /** The blocked record's start — where the arrowhead lands. */
  readonly x2: number;
  readonly y2: number;
  /** The lane between the two rows, for a route that has to travel back. */
  readonly gutterY: number;
  readonly elbow?: number;
}

/**
 * The band between two rows, measured from the blocked record's own row.
 *
 * A connector that has to run backwards travels here rather than through the
 * middle of a lane, where it would cross the bars it passes.
 */
export function connectorGutterY(
  fromIndex: number,
  toIndex: number,
  rowHeight: number,
  inset: number = GUTTER_INSET,
): number {
  return toIndex > fromIndex
    ? toIndex * rowHeight + inset
    : (toIndex + 1) * rowHeight - inset;
}

/**
 * The corners a connector turns, in order.
 *
 * Forwards — the blocker finishes before the record it blocks starts — is the
 * plain three-segment elbow: out, across, in.
 *
 * Backwards is the case worth having a rule for. When the blocked record
 * starts *before* its blocker finishes, the target is to the left of the
 * source, and turning at the source meant a single long horizontal run back
 * across the chart at the target's own height — straight through the target's
 * bar and anything else on that row. Instead the route steps into the lane
 * between the two rows, travels back there, and comes down onto the target's
 * start from just outside it. Same arrowhead, same meaning, nothing drawn over
 * a bar.
 *
 * A conflict is still only *drawn*; the chart never reschedules anyone to make
 * the arrow point the easy way.
 */
export function connectorPoints({
  x1,
  y1,
  x2,
  y2,
  gutterY,
  elbow = CONNECTOR_ELBOW,
}: ConnectorInput): readonly Point[] {
  const approach = x2 - elbow;

  if (approach >= x1 + elbow) {
    return [
      { x: x1, y: y1 },
      { x: approach, y: y1 },
      { x: approach, y: y2 },
      { x: x2, y: y2 },
    ];
  }

  const leave = x1 + elbow;

  return [
    { x: x1, y: y1 },
    { x: leave, y: y1 },
    { x: leave, y: gutterY },
    { x: approach, y: gutterY },
    { x: approach, y: y2 },
    { x: x2, y: y2 },
  ];
}

/** Corners as an SVG path. Every leg is orthogonal, so each is an H or a V. */
export function connectorPath(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return "";

  let path = `M ${first.x} ${first.y}`;
  let previous = first;

  for (const point of rest) {
    if (point.x !== previous.x) path += ` H ${point.x}`;
    if (point.y !== previous.y) path += ` V ${point.y}`;
    previous = point;
  }

  return path;
}
