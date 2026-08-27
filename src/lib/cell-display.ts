import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "@/lib/board-schema";
import type { BoardColumn, CellDisplayMode } from "@/types";

/**
 * How tall a row has to be to show what is in it.
 *
 * A QA step is a paragraph, not a word, and a table that clips every one of
 * them to a single line is a table you cannot read a test case out of. The
 * three modes are the answers: keep it to a line, give it a few, or give it all
 * of them.
 *
 * Everything here is *arithmetic*. Nothing measures the DOM, and nothing needs
 * to: a row's height is a function of its text, the column's width and the
 * mode, so five thousand rows cost five thousand divisions rather than five
 * thousand layouts. That is what keeps the virtualiser exact — it can know the
 * height of a row it has never mounted, which is the whole premise of knowing
 * where row 4.000 starts without rendering rows 1 to 3.999.
 *
 * The estimate is deliberately approximate. It is used to *reserve* space, and
 * the cell itself clips to the height reserved, so an estimate that is a
 * character or two out changes where a line breaks, never whether the grid
 * stays aligned.
 */

export const DISPLAY_MODE_LABELS: Readonly<
  Record<CellDisplayMode, { readonly label: string; readonly summary: string }>
> = {
  compact: { label: "Compact", summary: "One line. Click to read the rest." },
  wrap: { label: "Wrap", summary: "Up to six lines, then clipped." },
  full: { label: "Full", summary: "The whole value, however long." },
};

/** Wrap mode's ceiling — enough for a step, short of a row filling the screen. */
export const WRAP_MAX_LINES = 6;

/**
 * Full mode's ceiling. "Full" means the whole value in every case anyone
 * actually writes; the bound only stops one pasted document from making a row
 * taller than the viewport, which would be unscrollable rather than readable.
 */
export const FULL_MAX_LINES = 40;

/** One line of `text-lead` at the grid's leading. */
export const LINE_HEIGHT = 20;

/** The padding a wrapped cell keeps above and below its text, together. */
export const CELL_BLOCK_PADDING = 12;

/** Horizontal padding of `CellShell`, both sides. */
const CELL_INLINE_PADDING = 16;

/**
 * Average advance width of a character at the grid's text size.
 *
 * A single number rather than a per-glyph table: the difference between `i` and
 * `W` matters to a text renderer and not to a row height that is then clipped.
 */
const AVERAGE_CHAR_WIDTH = 6.6;

/**
 * Columns whose content can be worth more than one line.
 *
 * Chips, dates, avatars and file thumbnails are laid out, not flowed — a second
 * line would not show more of them, so they are left alone and their rows stay
 * exactly as tall as they were.
 */
export function isFlexibleColumn(column: BoardColumn): boolean {
  return column.type === "text" || column.type === "longText";
}

export function maxLinesFor(mode: CellDisplayMode): number {
  if (mode === "compact") return 1;
  return mode === "wrap" ? WRAP_MAX_LINES : FULL_MAX_LINES;
}

/** How many characters fit on one line of a column this wide. */
export function charsPerLine(width: number): number {
  const usable = Math.max(1, width - CELL_INLINE_PADDING);
  return Math.max(1, Math.floor(usable / AVERAGE_CHAR_WIDTH));
}

/**
 * Lines this text takes in a column this wide, hard newlines respected and the
 * mode's ceiling applied.
 */
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

/** The height a row of `lines` lines needs, never below the view's own. */
export function heightForLines(lines: number, baseHeight: number): number {
  if (lines <= 1) return baseHeight;
  return Math.max(baseHeight, CELL_BLOCK_PADDING + lines * LINE_HEIGHT);
}

/* ------------------------------------------------------------- auto fit */

/** Auto fit never produces a column wider than this, however long the text. */
export const AUTO_FIT_MAX_WIDTH = 480;

/** Room for the header's own icon, menu button and padding. */
const HEADER_CHROME = 56;

/**
 * A width that fits what is actually in the column.
 *
 * Computed from the longest *line* rather than the longest value, because a
 * value with newlines in it is already several lines wide and sizing to its
 * total length would produce a column nobody asked for. Bounded at both ends:
 * the result is a column width, and a column width is a thing the user can
 * still drag.
 */
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
