
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const CONNECTOR_ELBOW = 10;

export interface ConnectorInput {
  readonly fromStartX: number;
  readonly fromEndX: number;
  readonly fromY: number;
  readonly toStartX: number;
  readonly toY: number;
  readonly elbow?: number;
}

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
