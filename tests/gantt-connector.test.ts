import { describe, expect, test } from "vitest";
import {
  CONNECTOR_ELBOW,
  connectorPath,
  connectorPoints,
  type Point,
} from "@/lib/gantt-connector";

/**
 * Connector routing.
 *
 * A lane holds exactly one bar, so the property under test throughout is that
 * every horizontal leg stays outside the bar in its own lane. Anything else
 * draws a wire across a task it has nothing to do with.
 */

/** Horizontal legs at a given height, as [from, to] pairs. */
function legsAt(points: readonly Point[], y: number): readonly (readonly [number, number])[] {
  const legs: (readonly [number, number])[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    if (from.y === y && to.y === y) legs.push([from.x, to.x]);
  }

  return legs;
}

describe("routing a blocked-by connector", () => {
  /** A schedule that holds together: the blocker finishes, then the work starts. */
  test("forwards leaves the blocker's finish and lands on the target's start", () => {
    const points = connectorPoints({
      fromStartX: 40,
      fromEndX: 100,
      fromY: 20,
      toStartX: 300,
      toY: 64,
    });

    expect(points).toEqual([
      { x: 100, y: 20 },
      { x: 290, y: 20 },
      { x: 290, y: 64 },
      { x: 300, y: 64 },
    ]);
  });

  /**
   * The conflict case: the target starts before its blocker finishes, so it
   * lies to the *left*. Leaving from the finish sent the wire right, away from
   * the target, and then all the way back across whatever it passed.
   */
  test("backwards leaves the blocker's start and drops down the left of both", () => {
    const points = connectorPoints({
      fromStartX: 340,
      fromEndX: 400,
      fromY: 22,
      toStartX: 200,
      toY: 66,
    });

    expect(points).toEqual([
      { x: 340, y: 22 },
      { x: 190, y: 22 },
      { x: 190, y: 66 },
      { x: 200, y: 66 },
    ]);
  });

  test("neither horizontal leg touches the bar in its own lane", () => {
    const blocker = { fromStartX: 340, fromEndX: 400, fromY: 22 };
    const points = connectorPoints({ ...blocker, toStartX: 200, toY: 66 });

    // Left of the blocker's own start, so it never crosses the blocker.
    for (const [from, to] of legsAt(points, 22)) {
      expect(Math.max(from, to)).toBeLessThanOrEqual(blocker.fromStartX);
    }
    // Left of the target's start, so it never crosses the target.
    for (const [from, to] of legsAt(points, 66)) {
      expect(Math.max(from, to)).toBeLessThanOrEqual(200);
    }
  });

  test("a target further left still routes outside both bars", () => {
    const points = connectorPoints({
      fromStartX: 340,
      fromEndX: 400,
      fromY: 22,
      toStartX: 60,
      toY: 66,
    });

    // The channel clears the leftmost of the two, which is the target.
    expect(points[1]?.x).toBe(60 - CONNECTOR_ELBOW);
    expect(points.at(-1)).toEqual({ x: 60, y: 66 });
  });

  /**
   * Barely forwards is not forwards. Squeezing the elbow into a gap too small
   * for it made the final leg run backwards over its own source.
   */
  test("a gap too tight for the elbow takes the left-hand route", () => {
    const points = connectorPoints({
      fromStartX: 40,
      fromEndX: 100,
      fromY: 20,
      toStartX: 105,
      toY: 64,
    });

    expect(points[0]).toEqual({ x: 40, y: 20 });
    expect(points[1]?.x).toBe(40 - CONNECTOR_ELBOW);
  });

  test("the arrow always lands on the blocked record's start", () => {
    for (const toStartX of [40, 100, 260, 800]) {
      const points = connectorPoints({
        fromStartX: 90,
        fromEndX: 150,
        fromY: 20,
        toStartX,
        toY: 64,
      });

      expect(points.at(-1)).toEqual({ x: toStartX, y: 64 });
    }
  });

  test("every leg is orthogonal, so the path is only H and V", () => {
    const points = connectorPoints({
      fromStartX: 340,
      fromEndX: 400,
      fromY: 22,
      toStartX: 200,
      toY: 66,
    });
    const path = connectorPath(points);

    expect(path.startsWith("M 340 22")).toBe(true);
    expect(path).not.toMatch(/[LlCcQq]/);
    expect(path.match(/[HV]/g)?.length).toBe(points.length - 1);
  });

  test("an empty route is an empty path, not a broken one", () => {
    expect(connectorPath([])).toBe("");
  });
});
