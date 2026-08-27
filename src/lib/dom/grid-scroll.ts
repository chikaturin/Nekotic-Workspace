/**
 * Keeping an opened cell editor out from under the frozen columns.
 *
 * The grid freezes two things on the left: the row gutter and the primary
 * column. They are `position: sticky`, which means they stay put while the rest
 * of the row slides underneath them — and an editor opened on a cell that is
 * *partly* underneath would be drawn from that cell's left edge, i.e. starting
 * behind the frozen pane.
 *
 * The layer order already stops that from looking broken: the frozen columns
 * outrank the editor, so it goes behind them rather than bleeding across. This
 * is the other half — scrolling the cell out from under the pane first, so the
 * editor has somewhere honest to open. Doing it here rather than in the
 * component keeps the DOM reading in one place and out of the render path.
 */

/** Marks the horizontally scrolling element the grid lives in. */
export const GRID_SCROLLER_ATTR = "data-grid-scroller";

/** Marks the sticky cells the rest of a row scrolls beneath. */
export const GRID_FROZEN_ATTR = "data-grid-frozen";

/**
 * Scroll `cell` clear of the frozen pane, if any of it is hidden behind one.
 *
 * A no-op for a cell that is already fully visible, for the frozen cells
 * themselves, and anywhere the expected structure is missing — this is a
 * convenience, and it must never be the reason an editor fails to open.
 */
export function revealBeyondFrozen(cell: HTMLElement | null): void {
  if (!cell || cell.hasAttribute(GRID_FROZEN_ATTR)) return;

  const scroller = cell.closest<HTMLElement>(`[${GRID_SCROLLER_ATTR}]`);
  if (!scroller) return;

  const row = cell.closest<HTMLElement>('[role="row"]');
  const frozen = row ? [...row.querySelectorAll<HTMLElement>(`[${GRID_FROZEN_ATTR}]`)] : [];

  // With nothing frozen the viewport's own left edge is the boundary.
  const boundary = frozen.reduce(
    (right, element) => Math.max(right, element.getBoundingClientRect().right),
    scroller.getBoundingClientRect().left,
  );

  const hidden = boundary - cell.getBoundingClientRect().left;
  if (hidden > 0) scroller.scrollLeft -= hidden;
}
