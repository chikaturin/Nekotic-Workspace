import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "@/lib/board-schema";
import type { BoardColumn, CellDisplayMode } from "@/types";

export const DISPLAY_MODE_LABELS: Readonly<
  Record<CellDisplayMode, { readonly label: string; readonly summary: string }>
> = {
  compact: { label: "Compact", summary: "One line. Click to read the rest." },
  wrap: { label: "Wrap", summary: "Up to six lines, then clipped." },
  full: { label: "Full", summary: "The whole value, however long." },
};

export const WRAP_MAX_LINES = 6;

export const FULL_MAX_LINES = 40;

export const LINE_HEIGHT = 20;

export const CELL_BLOCK_PADDING = 12;

const CELL_INLINE_PADDING = 16;

const AVERAGE_CHAR_WIDTH = 6.6;

export function isFlexibleColumn(column: BoardColumn): boolean {
  return column.type === "text" || column.type === "longText";
}

export function maxLinesFor(mode: CellDisplayMode): number {
  if (mode === "compact") return 1;
  return mode === "wrap" ? WRAP_MAX_LINES : FULL_MAX_LINES;
}

export function charsPerLine(width: number): number {
  const usable = Math.max(1, width - CELL_INLINE_PADDING);
  return Math.max(1, Math.floor(usable / AVERAGE_CHAR_WIDTH));
}

export function estimateLines(text: string, width: number, mode: CellDisplayMode): number {
  const limit = maxLinesFor(mode);
  if (limit === 1 || text.length === 0) return 1;

  const perLine = charsPerLine(width);
  let lines = 0;

  for (const segment of text.split("\n")) {
    lines += Math.max(1, Math.ceil(segment.length / perLine));
    if (lines >= limit) return limit;
  }

  return Math.max(1, Math.min(limit, lines));
}

export function heightForLines(lines: number, baseHeight: number): number {
  if (lines <= 1) return baseHeight;
  return Math.max(baseHeight, CELL_BLOCK_PADDING + lines * LINE_HEIGHT);
}

export const AUTO_FIT_MAX_WIDTH = 480;

const HEADER_CHROME = 56;

export function autoFitWidth(texts: readonly string[], headerName: string): number {
  let longest = headerName.length + HEADER_CHROME / AVERAGE_CHAR_WIDTH;

  for (const text of texts) {
    for (const line of text.split("\n")) {
      if (line.length > longest) longest = line.length;
    }
  }

  const width = Math.ceil(longest * AVERAGE_CHAR_WIDTH) + CELL_INLINE_PADDING;

  return Math.min(
    AUTO_FIT_MAX_WIDTH,
    Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, width)),
  );
}
