/**
 * The arithmetic behind a pannable, zoomable canvas.
 *
 * All of it is pure: a transform in, a transform out. The hook that drives the
 * pointer events owns the DOM and the animation frames; everything that can be
 * reasoned about — where a zoom lands, how far a drag may go, what "fit" means
 * for a given picture — lives here where it can be read and tested.
 *
 * The transform is applied as `translate(x, y) scale(s)` from the stage's
 * top-left corner, so `(x, y)` is where the content's own origin sits inside
 * the viewport and the rendered box is `content * s`. Reading it in that order
 * matters: the translation is in viewport pixels, never scaled ones.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Transform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

/** Far enough out to place a poster, far enough in to read a single pixel. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 16;

/** One button press or wheel notch. Multiplicative, so every step feels equal. */
export const ZOOM_STEP = 1.2;

/** Breathing room around a fitted picture, in viewport pixels. */
export const FIT_PADDING = 32;

/**
 * How much of the picture must stay on screen. Panning is otherwise free — the
 * canvas should feel loose — but a picture dragged entirely into the void with
 * no way back is a trap rather than a feature.
 */
export const MIN_VISIBLE = 64;

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

export function isMeasured(size: Size | null): size is Size {
  return size !== null && size.width > 0 && size.height > 0;
}

/**
 * The scale at which the whole picture is visible, aspect ratio intact.
 *
 * Small pictures are left alone: blowing a 64×64 icon up to fill a 4K viewport
 * shows nothing but interpolation. `allowUpscale` is for callers that really do
 * want the content to fill the frame.
 */
export function fitScale(
  content: Size,
  viewport: Size,
  { padding = FIT_PADDING, allowUpscale = false }: { padding?: number; allowUpscale?: boolean } = {},
): number {
  if (!isMeasured(content) || !isMeasured(viewport)) return 1;

  const available: Size = {
    width: Math.max(viewport.width - padding * 2, 1),
    height: Math.max(viewport.height - padding * 2, 1),
  };

  const scale = Math.min(available.width / content.width, available.height / content.height);
  return clampScale(allowUpscale ? scale : Math.min(scale, 1));
}

/** The transform that puts the content in the middle of the viewport. */
export function centered(content: Size, viewport: Size, scale: number): Transform {
  const safe = clampScale(scale);

  return {
    scale: safe,
    x: (viewport.width - content.width * safe) / 2,
    y: (viewport.height - content.height * safe) / 2,
  };
}

/** Fit and centre in one call — what "Fit" and "Reset" both do. */
export function fitTransform(
  content: Size,
  viewport: Size,
  options?: { padding?: number; allowUpscale?: boolean },
): Transform {
  return centered(content, viewport, fitScale(content, viewport, options));
}

/**
 * Zoom while holding one point still.
 *
 * `anchor` is in viewport coordinates — the cursor, or the middle of the frame
 * for a button press. Keeping whatever is under the cursor under the cursor is
 * the difference between inspecting a detail and losing it: the alternative,
 * re-centring on every notch, makes the picture bolt away from what you were
 * looking at.
 */
export function zoomAt(transform: Transform, nextScale: number, anchor: Point): Transform {
  const scale = clampScale(nextScale);
  const ratio = scale / transform.scale;

  return {
    scale,
    x: anchor.x - (anchor.x - transform.x) * ratio,
    y: anchor.y - (anchor.y - transform.y) * ratio,
  };
}

/** Multiply the current scale by `factor`, anchored. */
export function zoomBy(transform: Transform, factor: number, anchor: Point): Transform {
  return zoomAt(transform, transform.scale * factor, anchor);
}

/** The middle of a viewport — the anchor a keyboard or button zoom uses. */
export function centerOf(viewport: Size): Point {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

/**
 * Pull a transform back until a sliver of the content is on screen again.
 *
 * The bounds are deliberately generous: this is not "keep the picture inside
 * the frame", it is "do not let it leave entirely".
 */
export function clampTransform(
  transform: Transform,
  content: Size,
  viewport: Size,
  minVisible: number = MIN_VISIBLE,
): Transform {
  if (!isMeasured(content) || !isMeasured(viewport)) return transform;

  const box: Size = {
    width: content.width * transform.scale,
    height: content.height * transform.scale,
  };

  // A picture narrower than the margin can never satisfy it, so the margin
  // shrinks to the picture rather than pinning it to one edge.
  const marginX = Math.min(minVisible, box.width);
  const marginY = Math.min(minVisible, box.height);

  return {
    scale: transform.scale,
    x: Math.min(Math.max(transform.x, marginX - box.width), viewport.width - marginX),
    y: Math.min(Math.max(transform.y, marginY - box.height), viewport.height - marginY),
  };
}

/** `translate(x, y) scale(s)` — the string the stage element carries. */
export function toCssTransform({ scale, x, y }: Transform): string {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

/** What the toolbar shows. Rounded to whole percent so it stops flickering. */
export function scaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Distance between two pointers — the pinch gesture's only input. */
export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
