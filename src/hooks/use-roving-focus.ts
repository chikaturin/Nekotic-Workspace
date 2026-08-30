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

export type RovingOrientation = "horizontal" | "vertical";

const NOOP_REF: RefCallback<HTMLElement> = () => {};

const ALWAYS_ENABLED = (): boolean => true;

export interface StepInput {
  readonly from: number;
  readonly delta: 1 | -1;
  readonly count: number;
  readonly loop: boolean;
  readonly isEnabled: (index: number) => boolean;
}

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
  readonly orientation?: RovingOrientation;
  readonly loop?: boolean;
  readonly activeIndex?: number;
  readonly onSelect?: (index: number) => void;
  readonly isEnabled?: (index: number) => boolean;
}

export interface RovingFocus {
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly itemRef: (index: number) => RefCallback<HTMLElement>;
}

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

  const requestedIndex = controlledIndex ?? internalIndex;
  const activeIndex = count === 0 ? -1 : Math.min(Math.max(requestedIndex, 0), count - 1);

  const setActiveIndex = useCallback((index: number) => setInternalIndex(index), []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (count === 0) return;

      const target = event.target instanceof Node ? event.target : null;
      const origin =
        target === null
          ? -1
          : itemNodes.current.findIndex((node) => node !== null && node.contains(target));

      if (origin < 0) return;

      const isHorizontal = orientation === "horizontal";
      const isNext = event.key === (isHorizontal ? "ArrowRight" : "ArrowDown");
      const isPrevious = event.key === (isHorizontal ? "ArrowLeft" : "ArrowUp");
      const isEdge = event.key === "Home" || event.key === "End";

      if (isNext || isPrevious || isEdge) {
        event.preventDefault();

        const next = isEdge
          ? edgeIndex(count, isEnabled, event.key === "End")
          : stepIndex({ from: origin, delta: isNext ? 1 : -1, count, loop, isEnabled });

        if (next < 0 || next === origin) return;

        if (controlledIndex === undefined) setInternalIndex(next);

        itemNodes.current[next]?.focus();
        onSelect?.(next);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (!isEnabled(origin)) return;

        event.preventDefault();
        onSelect?.(origin);
      }
    },
    [count, orientation, loop, controlledIndex, onSelect, isEnabled],
  );

  return { activeIndex, setActiveIndex, handleKeyDown, itemRef };
}

export interface ListboxKeyboardInput<T> {
  readonly options: readonly T[];
  readonly onSelect: (option: T, index: number) => void;
  readonly onClose?: () => void;
  readonly isOpen?: boolean;
  readonly loop?: boolean;
  readonly isOptionEnabled?: (option: T, index: number) => boolean;
  readonly resetKey?: string;
}

export interface ListboxKeyboard<T> {
  readonly activeIndex: number;
  readonly activeOption: T | null;
  readonly setActiveIndex: (index: number) => void;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean;
}

interface Highlight {
  readonly key: string | undefined;
  readonly index: number;
}

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

  const storedIndex = highlight.key === resetKey ? highlight.index : -1;
  const activeIndex =
    storedIndex >= 0 && storedIndex < count && isEnabled(storedIndex)
      ? storedIndex
      : fallbackIndex;

  const setActiveIndex = useCallback(
    (index: number) => setHighlight({ key: resetKey, index }),
    [resetKey],
  );

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
