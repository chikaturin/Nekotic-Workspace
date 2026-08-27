import { describe, expect, test } from "vitest";
import {
  centered,
  centerOf,
  clampScale,
  clampTransform,
  distanceBetween,
  fitScale,
  fitTransform,
  IDENTITY,
  isMeasured,
  MAX_SCALE,
  midpointOf,
  MIN_SCALE,
  MIN_VISIBLE,
  scaleLabel,
  toCssTransform,
  zoomAt,
  zoomBy,
  type Size,
  type Transform,
} from "@/lib/pan-zoom";

/**
 * The canvas' arithmetic. Everything the reader feels — the picture staying
 * under the cursor, a small image not being blown up, a dragged picture never
 * quite escaping — is one of these functions.
 */

const VIEWPORT: Size = { width: 1000, height: 600 };
const LARGE: Size = { width: 4000, height: 3000 };
const SMALL: Size = { width: 80, height: 60 };

describe("fitting", () => {
  test("a picture larger than the frame is scaled down to fit inside the padding", () => {
    const scale = fitScale(LARGE, VIEWPORT, { padding: 0 });

    expect(scale).toBeCloseTo(600 / 3000);
    expect(LARGE.width * scale).toBeLessThanOrEqual(VIEWPORT.width);
    expect(LARGE.height * scale).toBeLessThanOrEqual(VIEWPORT.height);
  });

  test("padding is taken off both sides before fitting", () => {
    const padded = fitScale(LARGE, VIEWPORT, { padding: 50 });

    expect(padded).toBeLessThan(fitScale(LARGE, VIEWPORT, { padding: 0 }));
  });

  test("aspect ratio is preserved — one scale for both axes", () => {
    const scale = fitScale({ width: 4000, height: 100 }, VIEWPORT, { padding: 0 });

    // The wide side is the binding constraint; the short side just follows.
    expect(scale).toBeCloseTo(1000 / 4000);
  });

  /** Blowing a 80x60 icon up to fill a 4K frame shows interpolation, not detail. */
  test("a picture smaller than the frame is left at its own size", () => {
    expect(fitScale(SMALL, VIEWPORT)).toBe(1);
  });

  test("...unless the caller asks for it to fill the frame", () => {
    expect(fitScale(SMALL, VIEWPORT, { padding: 0, allowUpscale: true })).toBeGreaterThan(1);
  });

  test("an unmeasured picture or frame falls back to 1", () => {
    expect(fitScale({ width: 0, height: 0 }, VIEWPORT)).toBe(1);
    expect(fitScale(LARGE, { width: 0, height: 0 })).toBe(1);
  });

  test("fitting centres the picture in the frame", () => {
    const transform = fitTransform(LARGE, VIEWPORT, { padding: 0 });
    const box = { width: LARGE.width * transform.scale, height: LARGE.height * transform.scale };

    expect(transform.x + box.width / 2).toBeCloseTo(VIEWPORT.width / 2);
    expect(transform.y + box.height / 2).toBeCloseTo(VIEWPORT.height / 2);
  });
});

describe("scale limits", () => {
  test("clamping holds the scale inside the usable range", () => {
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(2)).toBe(2);
  });

  test("zooming cannot escape the range either", () => {
    expect(zoomBy(IDENTITY, 1e6, { x: 0, y: 0 }).scale).toBe(MAX_SCALE);
    expect(zoomBy(IDENTITY, 1e-6, { x: 0, y: 0 }).scale).toBe(MIN_SCALE);
  });
});

describe("zooming around a point", () => {
  /**
   * The whole reason this is not a plain scale change: whatever is under the
   * cursor has to still be under the cursor afterwards, or inspecting a detail
   * means chasing it around the canvas.
   */
  test("the content point under the anchor does not move", () => {
    const before: Transform = { scale: 1.5, x: -200, y: -100 };
    const anchor = { x: 640, y: 320 };

    const contentPointBefore = {
      x: (anchor.x - before.x) / before.scale,
      y: (anchor.y - before.y) / before.scale,
    };

    const after = zoomBy(before, 2.5, anchor);
    const contentPointAfter = {
      x: (anchor.x - after.x) / after.scale,
      y: (anchor.y - after.y) / after.scale,
    };

    expect(contentPointAfter.x).toBeCloseTo(contentPointBefore.x);
    expect(contentPointAfter.y).toBeCloseTo(contentPointBefore.y);
  });

  test("zooming in and back out returns to where it started", () => {
    const start: Transform = { scale: 1, x: 40, y: 25 };
    const anchor = { x: 300, y: 200 };

    const round = zoomBy(zoomBy(start, 3, anchor), 1 / 3, anchor);

    expect(round.scale).toBeCloseTo(start.scale);
    expect(round.x).toBeCloseTo(start.x);
    expect(round.y).toBeCloseTo(start.y);
  });

  test("zooming to an explicit scale keeps the same anchor promise", () => {
    const after = zoomAt({ scale: 2, x: 10, y: 10 }, 1, { x: 500, y: 300 });

    expect(after.scale).toBe(1);
    expect(after.x).toBeCloseTo(500 - (500 - 10) / 2);
  });

  test("a button zoom anchors on the middle of the frame", () => {
    expect(centerOf(VIEWPORT)).toEqual({ x: 500, y: 300 });
  });
});

describe("keeping the picture reachable", () => {
  test("a picture dragged far off to the left is pulled back to a sliver", () => {
    const box = { width: LARGE.width * 1, height: LARGE.height * 1 };
    const clamped = clampTransform({ scale: 1, x: -99_999, y: 0 }, LARGE, VIEWPORT);

    expect(clamped.x).toBe(MIN_VISIBLE - box.width);
    // A sliver is still on screen: its right edge has not crossed the frame.
    expect(clamped.x + box.width).toBeGreaterThanOrEqual(MIN_VISIBLE);
  });

  test("a picture dragged far off to the right is pulled back too", () => {
    const clamped = clampTransform({ scale: 1, x: 99_999, y: 99_999 }, LARGE, VIEWPORT);

    expect(clamped.x).toBe(VIEWPORT.width - MIN_VISIBLE);
    expect(clamped.y).toBe(VIEWPORT.height - MIN_VISIBLE);
  });

  test("a picture inside the frame is left exactly where it is", () => {
    const transform: Transform = { scale: 0.2, x: 100, y: 60 };

    expect(clampTransform(transform, LARGE, VIEWPORT)).toEqual(transform);
  });

  /** The margin cannot demand more of the picture than the picture has. */
  test("a picture smaller than the margin is not pinned to an edge", () => {
    const tiny: Size = { width: 20, height: 20 };
    const clamped = clampTransform({ scale: 1, x: 400, y: 300 }, tiny, VIEWPORT);

    expect(clamped.x).toBe(400);
    expect(clamped.y).toBe(300);
  });

  test("nothing is clamped before the picture has been measured", () => {
    const transform: Transform = { scale: 1, x: -5000, y: -5000 };

    expect(clampTransform(transform, { width: 0, height: 0 }, VIEWPORT)).toEqual(transform);
  });

  test("fit always lands inside its own clamp — Fit is a way back", () => {
    const fitted = fitTransform(LARGE, VIEWPORT);

    expect(clampTransform(fitted, LARGE, VIEWPORT)).toEqual(fitted);
  });
});

describe("rendering the transform", () => {
  test("translate is applied before scale, in viewport pixels", () => {
    expect(toCssTransform({ scale: 2, x: 10, y: -5 })).toBe(
      "translate3d(10px, -5px, 0) scale(2)",
    );
  });

  test("the label is whole percent, so it stops flickering mid-gesture", () => {
    expect(scaleLabel(1)).toBe("100%");
    expect(scaleLabel(0.7512)).toBe("75%");
  });

  test("centred is the transform fit builds on", () => {
    expect(centered(SMALL, VIEWPORT, 1)).toEqual({ scale: 1, x: 460, y: 270 });
  });
});

describe("pinch inputs", () => {
  test("distance and midpoint describe a two-finger gesture", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 30, y: 40 };

    expect(distanceBetween(a, b)).toBe(50);
    expect(midpointOf(a, b)).toEqual({ x: 15, y: 20 });
  });

  test("a size is only measured once both sides are positive", () => {
    expect(isMeasured({ width: 10, height: 10 })).toBe(true);
    expect(isMeasured({ width: 0, height: 10 })).toBe(false);
    expect(isMeasured(null)).toBe(false);
  });
});
