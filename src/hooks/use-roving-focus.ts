"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
} from "react";

/**
 * The keyboard substrate for composite widgets — tab strips, segmented
 * controls, popover listboxes.
 *
 * `@radix-ui/react-roving-focus` is not a dependency and cannot become one, so
 * the two keyboard shapes the app actually needs live here instead of being
 * re-invented, slightly differently, in every toolbar:
 *
 *  - `useRovingFocus` — one tab stop for the whole group, arrow keys inside it.
 *    DOM focus moves with the arrows, which is what `role="tablist"` and
 *    `role="radiogroup"` require.
 *  - `useListboxKeyboard` — the search-and-pick case, where DOM focus must stay
 *    in the text field and only a highlight moves. Lifted from
 *    `use-mention-picker`, which had the only correct implementation.
 */

export type RovingOrientation = "horizontal" | "vertical";

/** A group with no registered node for an index still needs a callable ref. */
const NOOP_REF: RefCallback<HTMLElement> = () => {};

const ALWAYS_ENABLED = (): boolean => true;

export interface StepInput {
  readonly from: number;
  readonly delta: 1 | -1;
  readonly count: number;
  readonly loop: boolean;
  readonly isEnabled: (index: number) => boolean;
}

/**
 * Next selectable index in `delta`'s direction, skipping disabled entries.
 *
 * The attempt counter is not defensive padding: a group whose every item is
 * disabled would otherwise wrap forever looking for a landing spot. Returning
 * `from` in that case leaves focus exactly where the user put it.
 */
export function stepIndex({ from, delta, count, loop, isEnabled }: StepInput): number {
  if (count === 0) return -1;

  let candidate = from;

  for (let attempt = 0; attempt < count; attempt += 1) {
    const next = candidate + delta;

    if (next < 0 || next >= count) {
      if (!loop) return from;
      candidate = next < 0 ? count - 1 : 0;
    } else {
      candidate = next;
    }

    if (isEnabled(candidate)) return candidate;
  }

  return from;
}

/**
 * First selectable index, or the last one when `fromEnd`. Home and End.
 *
 * Walking in from one past the edge reuses the skip logic, but it also means
 * a group with nothing selectable in it hands back the out-of-range seed it
 * started from — so the result is checked rather than trusted. -1 is the one
 * "nowhere to go" answer every caller already handles.
 */
function edgeIndex(
  count: number,
  isEnabled: (index: number) => boolean,
  fromEnd: boolean,
): number {
  const found = fromEnd
    ? stepIndex({ from: count, delta: -1, count, loop: false, isEnabled })
    : stepIndex({ from: -1, delta: 1, count, loop: false, isEnabled });

  return found >= 0 && found < count ? found : -1;
}

export interface RovingFocusInput {
  readonly count: number;
  /** Which arrow pair walks the group. Defaults to horizontal. */
  readonly orientation?: RovingOrientation;
  /** Wrap past the ends. Defaults to true, as both ARIA patterns expect. */
  readonly loop?: boolean;
  /**
   * Controlled active index — pass the index of the selected value when the
   * group already holds its selection in state, which is every consumer today.
   * Omit it to let the hook own the index. Two sources of truth here is how a
   * component ends up syncing state in an effect, which the React Compiler
   * rules forbid outright.
   */
  readonly activeIndex?: number;
  /** Fired on Enter, Space, and on every arrow move — see below. */
  readonly onSelect?: (index: number) => void;
  readonly isEnabled?: (index: number) => boolean;
}

export interface RovingFocus {
  /** Always in range: the one item in the group carrying `tabIndex={0}`. */
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  /** Belongs on the group container — key presses bubble up from the items. */
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Stable per index, so items do not re-register their ref every render. */
  readonly itemRef: (index: number) => RefCallback<HTMLElement>;
}

/**
 * Roving tabindex: Tab enters the group once, arrows move within it.
 *
 * Selection follows focus ("automatic activation"). That is not a choice for
 * `role="radiogroup"` — an arrow key there *is* the change — and it is the
 * recommended default for tabs whose panels are cheap. A caller that wants
 * manual activation can ignore `onSelect`'s arrow-driven calls, but nothing in
 * the app wants that today.
 */
export function useRovingFocus({
  count,
  orientation = "horizontal",
  loop = true,
  activeIndex: controlledIndex,
  onSelect,
  isEnabled = ALWAYS_ENABLED,
}: RovingFocusInput): RovingFocus {
  const [internalIndex, setInternalIndex] = useState(0);
  const itemNodes = useRef<(HTMLElement | null)[]>([]);

  // Held in a memo rather than created inline so each item keeps the same ref
  // callback across renders; a fresh callback would detach and re-attach the
  // node on every keystroke, and React 19 calls the old one with null first.
  const itemRefs = useMemo(
    () =>
      Array.from(
        { length: count },
        (_, index): RefCallback<HTMLElement> =>
          (node) => {
            itemNodes.current[index] = node;
          },
      ),
    [count],
  );

  const itemRef = useCallback(
    (index: number) => itemRefs[index] ?? NOOP_REF,
    [itemRefs],
  );

  // A controlled index of -1 means "nothing selected yet" — an empty toggle
  // group, or a tab value that matches no trigger. Clamping to 0 keeps the
  // group reachable by Tab instead of turning it into a dead control.
  const requestedIndex = controlledIndex ?? internalIndex;
  const activeIndex = count === 0 ? -1 : Math.min(Math.max(requestedIndex, 0), count - 1);

  const setActiveIndex = useCallback((index: number) => setInternalIndex(index), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (count === 0) return;

      // Only keys pressed on an item are ours. A tab strip with a trailing
      // "add" button, or a segmented control sharing a toolbar row, would
      // otherwise have that button's Enter swallowed and turned into a
      // selection of whatever happened to be active.
      const target = event.target instanceof Node ? event.target : null;
      const origin =
        target === null
          ? -1
          : itemNodes.current.findIndex((node) => node !== null && node.contains(target));

      // Note this is where the user's focus is, not what is selected: the two
      // diverge whenever a controlled parent declines a change, and arrowing
      // away from a different item than the focused one is baffling.
      if (origin < 0) return;

      const isHorizontal = orientation === "horizontal";
      const isNext = event.key === (isHorizontal ? "ArrowRight" : "ArrowDown");
      const isPrevious = event.key === (isHorizontal ? "ArrowLeft" : "ArrowUp");
      const isEdge = event.key === "Home" || event.key === "End";

      if (isNext || isPrevious || isEdge) {
        // Claimed even when the index does not move: an unhandled ArrowDown
        // scrolls the page out from under a group the user is navigating.
        event.preventDefault();

        const next = isEdge
          ? edgeIndex(count, isEnabled, event.key === "End")
          : stepIndex({ from: origin, delta: isNext ? 1 : -1, count, loop, isEnabled });

        if (next < 0 || next === origin) return;

        // Tracked internally only when the caller is not already tracking it;
        // a controlled group re-renders from its own state and this write
        // would be a second render for a value that is then ignored.
        if (controlledIndex === undefined) setInternalIndex(next);

        itemNodes.current[next]?.focus();
        onSelect?.(next);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (!isEnabled(origin)) return;

        // Space would scroll and Enter would fire the button's own click, so
        // both are taken over here rather than left to fire `onSelect` twice.
        event.preventDefault();
        onSelect?.(origin);
      }
    },
    [count, orientation, loop, controlledIndex, onSelect, isEnabled],
  );

  return { activeIndex, setActiveIndex, handleKeyDown, itemRef };
}

export interface ListboxKeyboardInput<T> {
  /** Memoise this — a new array every render resets nothing, but costs work. */
  readonly options: readonly T[];
  readonly onSelect: (option: T, index: number) => void;
  readonly onClose?: () => void;
  /** Closed listboxes consume nothing, so Enter keeps meaning "submit". */
  readonly isOpen?: boolean;
  readonly loop?: boolean;
  readonly isOptionEnabled?: (option: T, index: number) => boolean;
  /**
   * Send the highlight back to the first selectable option whenever this
   * changes — the search query, normally. Keyed on a value rather than reset
   * from an effect, because a `setState` in `useEffect` is both a wasted
   * render and a React Compiler lint error.
   */
  readonly resetKey?: string;
}

export interface ListboxKeyboard<T> {
  readonly activeIndex: number;
  readonly activeOption: T | null;
  readonly setActiveIndex: (index: number) => void;
  /** Returns true when the listbox consumed the press. */
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
}

interface Highlight {
  readonly key: string | undefined;
  readonly index: number;
}

/**
 * The popover-listbox half: a search input keeps DOM focus while the arrows
 * move a highlight through the options below it. Rows are marked with
 * `aria-activedescendant`, never focused, because moving focus out of the
 * input would close the keyboard's own text entry mid-query.
 */
export function useListboxKeyboard<T>({
  options,
  onSelect,
  onClose,
  isOpen = true,
  loop = true,
  isOptionEnabled,
  resetKey,
}: ListboxKeyboardInput<T>): ListboxKeyboard<T> {
  const [highlight, setHighlight] = useState<Highlight>({ key: resetKey, index: 0 });

  const count = options.length;

  const isEnabled = useCallback(
    (index: number) => {
      const option = options[index];
      if (option === undefined) return false;
      return isOptionEnabled?.(option, index) ?? true;
    },
    [options, isOptionEnabled],
  );

  const fallbackIndex = useMemo(
    () => edgeIndex(count, isEnabled, false),
    [count, isEnabled],
  );

  // Derived, not stored: a highlight left over from a previous query — or one
  // pointing at a row that has since been filtered out or disabled — is simply
  // not used, so there is no stale state to clear.
  const storedIndex = highlight.key === resetKey ? highlight.index : -1;
  const activeIndex =
    storedIndex >= 0 && storedIndex < count && isEnabled(storedIndex)
      ? storedIndex
      : fallbackIndex;

  const setActiveIndex = useCallback(
    (index: number) => setHighlight({ key: resetKey, index }),
    [resetKey],
  );

  /**
   * Consuming a key also stops it propagating. These listboxes open inside
   * dialogs whose Escape listener sits on `document`: without this, Escape
   * would close the whole dialog instead of the popover in front of it.
   */
  const consume = useCallback((event: KeyboardEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!isOpen || count === 0) return false;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const next = stepIndex({
          from: activeIndex,
          delta: event.key === "ArrowDown" ? 1 : -1,
          count,
          loop,
          isEnabled,
        });

        consume(event);
        if (next >= 0) setHighlight({ key: resetKey, index: next });
        return true;
      }

      if (event.key === "Home" || event.key === "End") {
        const next = edgeIndex(count, isEnabled, event.key === "End");

        consume(event);
        if (next >= 0) setHighlight({ key: resetKey, index: next });
        return true;
      }

      if (event.key === "Enter") {
        const option = activeIndex >= 0 ? options[activeIndex] : undefined;
        // Nothing highlighted means nothing to take over — Enter still has to
        // reach the form the input is sitting in.
        if (option === undefined) return false;

        consume(event);
        onSelect(option, activeIndex);
        return true;
      }

      if (event.key === "Escape") {
        consume(event);
        onClose?.();
        return true;
      }

      return false;
    },
    [isOpen, count, activeIndex, loop, isEnabled, consume, resetKey, options, onSelect, onClose],
  );

  return {
    activeIndex,
    activeOption: activeIndex >= 0 ? options[activeIndex] ?? null : null,
    setActiveIndex,
    handleKeyDown,
  };
}

export interface RovingItemDescriptor {
  readonly value: string;
  readonly isDisabled: boolean;
}

/**
 * The ordered `value`/`disabled` pairs of a container's element children.
 *
 * Compound components (`<Tabs>`, `<ToggleGroup>`) need the item order before
 * the items render, to hand each one its index and to know how far the arrow
 * keys may travel. Reading it off the children beats a register-on-mount
 * effect, which would report DOM order only after a paint.
 *
 * It lives beside the hook because both compound components need exactly this
 * and a second copy would drift. The one constraint it imposes: items must be
 * direct children of their container. Mapping over an array is fine — that is
 * what `Children.toArray` flattens — but wrapping a trigger in a Fragment or
 * in another component hides it, and the item falls back to being its own tab
 * stop rather than silently disappearing from the keyboard order.
 */
export function collectRovingItems(children: ReactNode): readonly RovingItemDescriptor[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ readonly value?: unknown; readonly disabled?: unknown }>(child)) {
      return [];
    }

    const { value, disabled } = child.props;
    if (typeof value !== "string") return [];

    return [{ value, isDisabled: disabled === true }];
  });
}
