/**
 * Where a "blocked by" connector runs.
 *
 * Kept out of the component and free of any drawing so the route can be
 * reasoned about — and tested — as geometry, which is all it is.
 *
 * One fact makes the routing simple: a lane holds exactly one bar. So a
 * horizontal leg that stays outside the bar it belongs to crosses nothing at
 * all, and the whole problem is choosing which side of each bar to leave from.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** How far a connector reaches out of a bar before it turns. */
export const CONNECTOR_ELBOW = 10;

export interface ConnectorInput {
  /** The blocker's bar: both edges, because the route may leave from either. */
  readonly fromStartX: number;
  readonly fromEndX: number;
  readonly fromY: number;
  /** The blocked record's start — where the arrowhead lands. */
  readonly toStartX: number;
  readonly toY: number;
  readonly elbow?: number;
}

/**
 * The corners a connector turns, in order.
 *
 * Two routes, chosen by whether the blocked record actually starts after its
 * blocker finishes.
 *
 * **Forwards**, with room for it: leave the blocker's finish, across, and into
 * the target's start. The plain left-to-right elbow, which is what a schedule
 * that holds together looks like.
 *
 * **Backwards** — the target starts before its blocker finishes, which is the
 * conflict case — leaves from the blocker's *start* instead and drops down the
 * left of both bars. Leaving from the finish meant heading right, away from a
 * target that lies left, and then travelling all the way back; the wire spent
 * its length going the wrong way and crossed whatever it passed. Both bars are
 * approached from their left, which is the side the arrowhead lands on anyway.
 *
 * The channel sits left of both bars, so neither horizontal leg touches one.
 *
 * A conflict is still only *drawn*; the chart never reschedules anyone to make
 * the arrow point the easy way.
 */
export function connectorPoints({
  fromStartX,
  fromEndX,
  fromY,
  toStartX,
  toY,
  elbow = CONNECTOR_ELBOW,
}: ConnectorInput): readonly Point[] {
  const approach = toStartX - elbow;

  if (approach >= fromEndX + elbow) {
    return [
      { x: fromEndX, y: fromY },
      { x: approach, y: fromY },
      { x: approach, y: toY },
      { x: toStartX, y: toY },
    ];
  }

  const channel = Math.min(fromStartX, toStartX) - elbow;

  return [
    { x: fromStartX, y: fromY },
    { x: channel, y: fromY },
    { x: channel, y: toY },
    { x: toStartX, y: toY },
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
