
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

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 16;

export const ZOOM_STEP = 1.2;

export const FIT_PADDING = 32;

export const MIN_VISIBLE = 64;

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

export function isMeasured(size: Size | null): size is Size {
  return size !== null && size.width > 0 && size.height > 0;
}

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

export function centered(content: Size, viewport: Size, scale: number): Transform {
  const safe = clampScale(scale);

  return {
    scale: safe,
    x: (viewport.width - content.width * safe) / 2,
    y: (viewport.height - content.height * safe) / 2,
  };
}

export function fitTransform(
  content: Size,
  viewport: Size,
  options?: { padding?: number; allowUpscale?: boolean },
): Transform {
  return centered(content, viewport, fitScale(content, viewport, options));
}

export function zoomAt(transform: Transform, nextScale: number, anchor: Point): Transform {
  const scale = clampScale(nextScale);
  const ratio = scale / transform.scale;

  return {
    scale,
    x: anchor.x - (anchor.x - transform.x) * ratio,
    y: anchor.y - (anchor.y - transform.y) * ratio,
  };
}

export function zoomBy(transform: Transform, factor: number, anchor: Point): Transform {
  return zoomAt(transform, transform.scale * factor, anchor);
}

export function centerOf(viewport: Size): Point {
  return { x: viewport.width / 2, y: viewport.height / 2 };
}

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

  const marginX = Math.min(minVisible, box.width);
  const marginY = Math.min(minVisible, box.height);

  return {
    scale: transform.scale,
    x: Math.min(Math.max(transform.x, marginX - box.width), viewport.width - marginX),
    y: Math.min(Math.max(transform.y, marginY - box.height), viewport.height - marginY),
  };
}

export function toCssTransform({ scale, x, y }: Transform): string {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

export function scaleLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpointOf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
