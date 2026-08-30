
export const GRID_SCROLLER_ATTR = "data-grid-scroller";

export const GRID_FROZEN_ATTR = "data-grid-frozen";

export function revealBeyondFrozen(cell: HTMLElement | null): void {
  if (!cell || cell.hasAttribute(GRID_FROZEN_ATTR)) return;

  const scroller = cell.closest<HTMLElement>(`[${GRID_SCROLLER_ATTR}]`);
  if (!scroller) return;

  const row = cell.closest<HTMLElement>('[role="row"]');
  const frozen = row ? [...row.querySelectorAll<HTMLElement>(`[${GRID_FROZEN_ATTR}]`)] : [];

  const boundary = frozen.reduce(
    (right, element) => Math.max(right, element.getBoundingClientRect().right),
    scroller.getBoundingClientRect().left,
  );

  const hidden = boundary - cell.getBoundingClientRect().left;
  if (hidden > 0) scroller.scrollLeft -= hidden;
}
