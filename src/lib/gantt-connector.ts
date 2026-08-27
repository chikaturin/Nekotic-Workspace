/**
 * Where a "blocked by" connector runs.
 *
 * Kept out of the component and free of any drawing so the route can be
 * reasoned about — and tested — as geometry, which is all it is.
 *
 * One fact makes the routing simple: a lane holds exactly one bar. So a
 * horizontal leg that stays outside the bar in *its own* lane crosses nothing
 * that lane owns, and the whole problem reduces to choosing which side of each
 * bar to leave from and where to put the single vertical run between them.
 *
 * That vertical run has to cross whatever lanes lie between the two records,
 * and no amount of routing removes that — a connector between rows 3 and 9
 * passes rows 4 to 8 by definition. Obstacle avoidance is deliberately not
 * attempted: it needs a solver, it makes the route unpredictable to read, and
 * the chart already answers the problem the other way, by painting the bars in
 * a layer *above* the connectors so a crossing reads as passing behind.
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
 * **Forwards**, with room for it — the traditional Gantt elbow: out of the
 * blocker's finish, a short step right into the gutter behind it, down to the
 * target's lane, and along that lane into the target's start.
 *
 *     ██████████┐
 *               │
 *               └──────────▶████
 *
 * Turning down *early* rather than late is what keeps the long leg in the
 * target's own lane, where the only bar is the one the arrow is pointing at.
 * The earlier route ran the long leg at the blocker's height and dropped just
 * before the target, which put the descent in the middle of the chart.
 *
 * **Backwards** — the target starts before its blocker finishes, which is the
 * conflict case — leaves from the blocker's *start* instead and drops down the
 * left of both bars. Leaving from the finish meant heading right, away from a
 * target that lies left, and then travelling all the way back; the wire spent
 * its length going the wrong way. Both bars are approached from their left,
 * which is the side the arrowhead lands on anyway.
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
  const gutter = fromEndX + elbow;

  if (toStartX >= gutter) {
    return [
      { x: fromEndX, y: fromY },
      { x: gutter, y: fromY },
      { x: gutter, y: toY },
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
