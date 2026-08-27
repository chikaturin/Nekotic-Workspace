import { describe, expect, test } from "vitest";
import {
  CONNECTOR_ELBOW,
  connectorGutterY,
  connectorPath,
  connectorPoints,
  type Point,
} from "@/lib/gantt-connector";

/**
 * Connector routing.
 *
 * The property under test throughout: a connector never runs sideways at the
 * height of a bar it is not attached to. That is the whole reason the
 * backwards case exists — the naive route turned at the source and travelled
 * back at the target's own height, straight through the target's bar.
 */

const ROW_HEIGHT = 44;

function xsAt(points: readonly Point[], y: number): readonly number[] {
  const hits: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    // A horizontal leg at exactly this height.
    if (from.y === y && to.y === y) hits.push(from.x, to.x);
  }

  return hits;
}

describe("routing a blocked-by connector", () => {
  test("forwards is out, across and in — three legs", () => {
    const points = connectorPoints({ x1: 100, y1: 20, x2: 300, y2: 64, gutterY: 44 });

    expect(points).toEqual([
      { x: 100, y: 20 },
      { x: 290, y: 20 },
      { x: 290, y: 64 },
      { x: 300, y: 64 },
    ]);
  });

  /**
   * The case in the screenshot: the blocked record starts before its blocker
   * finishes, so the arrowhead is to the *left* of where the line leaves.
   */
  test("backwards travels in the lane between the rows, not across a bar", () => {
    const gutterY = connectorGutterY(0, 1, ROW_HEIGHT);
    const points = connectorPoints({ x1: 400, y1: 22, x2: 200, y2: 66, gutterY });

    // It leaves right of the blocker, drops into the lane, and only then goes
    // back — so the only sideways movement at either bar's height is the elbow
    // itself, never a run back across the chart.
    expect(xsAt(points, 22)).toEqual([400, 410]);
    expect(xsAt(points, 66)).toEqual([190, 200]);
    expect(points.at(-1)).toEqual({ x: 200, y: 66 });

    const sideways = xsAt(points, gutterY);
    expect(sideways).toEqual([410, 190]);
  });

  test("a tight forward gap routes the same way, rather than doubling back", () => {
    // Too close to fit "out, across, in" without the across leg running
    // backwards over the source.
    const points = connectorPoints({ x1: 100, y1: 20, x2: 105, y2: 64, gutterY: 44 });

    expect(points).toHaveLength(6);
    expect(xsAt(points, 64)).toEqual([95, 105]);
  });

  test("the arrow always lands on the blocked record's start", () => {
    for (const x2 of [40, 100, 260]) {
      const points = connectorPoints({ x1: 100, y1: 20, x2, y2: 64, gutterY: 44 });
      expect(points.at(-1)).toEqual({ x: x2, y: 64 });
      expect(points[0]).toEqual({ x: 100, y: 20 });
    }
  });

  test("the lane sits between the two rows, whichever way the link runs", () => {
    // Target below: the lane is just inside the top of the target's row.
    expect(connectorGutterY(0, 1, ROW_HEIGHT)).toBe(48);
    // Target above: just inside the bottom of it.
    expect(connectorGutterY(3, 1, ROW_HEIGHT)).toBe(84);
  });

  test("every leg is orthogonal, so the path is only H and V", () => {
    const points = connectorPoints({ x1: 400, y1: 22, x2: 200, y2: 66, gutterY: 48 });
    const path = connectorPath(points);

    expect(path.startsWith("M 400 22")).toBe(true);
    expect(path).not.toMatch(/[LlCcQq]/);
    expect(path.match(/[HV]/g)?.length).toBe(points.length - 1);
  });

  test("an empty route is an empty path, not a broken one", () => {
    expect(connectorPath([])).toBe("");
  });

  test("the elbow is the same reach on both sides", () => {
    const points = connectorPoints({ x1: 400, y1: 22, x2: 200, y2: 66, gutterY: 48 });

    expect(points[1]?.x).toBe(400 + CONNECTOR_ELBOW);
    expect(points.at(-2)?.x).toBe(200 - CONNECTOR_ELBOW);
  });
});
