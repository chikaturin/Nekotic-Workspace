"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
} from "react";
import { collectRovingItems, useRovingFocus } from "@/hooks/use-roving-focus";
import { cn } from "@/lib/utils";

/**
 * A single-select segmented control — pick exactly one of two or three.
 *
 * The app hand-rolled this four times and got a different answer each time:
 * the drive toolbar's is a `role="radiogroup"` whose children are
 * `role="radio"` with no `aria-checked`, so a screen reader reads three radios
 * and cannot say which one is on; the Gantt zoom and the export format grid
 * use `aria-pressed`, which describes three independent toggles rather than
 * one choice. None of the four had arrow keys. This is the radiogroup pattern
 * done once: one tab stop, arrows move and choose, `aria-checked` on every
 * item.
 *
 * `role="radio"` is deliberate over `aria-pressed`: the semantics of "one of
 * these is on" are what the control actually means, and it is what makes the
 * arrow keys expected rather than surprising.
 */

const toggleGroupVariants = cva("", {
  variants: {
    variant: {
      // The track carries the border and padding, and its height is the whole
      // control's height — box-sizing means the 1px rule and the 2px inset are
      // paid out of it. The hand-rolled version sized the *items* instead and
      // came out 30px tall, matching no other control in the toolbar.
      segmented: "inline-flex items-center rounded-md border border-border bg-surface p-0.5",
      // Cards size to their content; the caller supplies the column count.
      card: "grid gap-2",
    },
    size: { xs: "", sm: "", md: "" },
  },
  compoundVariants: [
    { variant: "segmented", size: "xs", class: "h-[var(--control-xs)]" },
    { variant: "segmented", size: "sm", class: "h-[var(--control-sm)]" },
    { variant: "segmented", size: "md", class: "h-[var(--control-md)]" },
  ],
  defaultVariants: { variant: "segmented", size: "sm" },
});

const toggleGroupItemVariants = cva(
  cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap outline-none",
    "transition-[background-color,border-color,color] duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        segmented: cn(
          "h-full justify-center rounded-sm px-[var(--control-pad-xs)] text-body",
          "[&_svg]:size-3.5",
        ),
        card: "flex-col items-start justify-start gap-1 rounded-lg border p-2.5 text-left [&_svg]:size-4",
      },
      state: { on: "", off: "" },
      /**
       * An icon with no label gets a square hit area instead of one padded to
       * the width of absent text. Derived from the children rather than asked
       * for as a prop, because a prop invites the call site where the prop and
       * the children disagree — and CSS cannot decide it alone: `:only-child`
       * ignores text nodes, so an icon beside a bare label still matches it.
       */
      shape: { auto: "", square: "" },
    },
    compoundVariants: [
      { variant: "segmented", shape: "square", class: "aspect-square px-0" },
      { variant: "segmented", state: "on", class: "bg-accent-soft text-accent" },
      {
        variant: "segmented",
        state: "off",
        class: "text-faint-foreground hover:bg-hover hover:text-foreground",
      },
      { variant: "card", state: "on", class: "border-accent bg-accent-soft" },
      {
        variant: "card",
        state: "off",
        class: "border-border bg-surface hover:border-border-strong",
      },
    ],
    defaultVariants: { variant: "segmented", state: "off", shape: "auto" },
  },
);

export type ToggleGroupVariant = NonNullable<
  VariantProps<typeof toggleGroupVariants>["variant"]
>;
export type ToggleGroupSize = NonNullable<VariantProps<typeof toggleGroupVariants>["size"]>;

interface ToggleGroupContextValue {
  readonly value: string;
  readonly select: (value: string) => void;
  readonly variant: ToggleGroupVariant;
  readonly values: readonly string[];
  readonly activeIndex: number;
  readonly itemRef: (index: number) => RefCallback<HTMLElement>;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

export type ToggleGroupProps = ComponentProps<"div"> & {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly variant?: ToggleGroupVariant;
  readonly size?: ToggleGroupSize;
  /**
   * Required. A radiogroup with no name is announced as a bare group of
   * radios, which is exactly as useful as it sounds.
   */
  readonly "aria-label": string;
};

export function ToggleGroup({
  value,
  onValueChange,
  variant = "segmented",
  size = "sm",
  className,
  children,
  onKeyDown,
  ...props
}: ToggleGroupProps) {
  const items = collectRovingItems(children);
  const values = items.map((item) => item.value);

  const roving = useRovingFocus({
    count: items.length,
    orientation: "horizontal",
    // Selection is the source of truth for which item holds the tab stop, so
    // the group has one state, not two that have to be kept in step.
    activeIndex: values.indexOf(value),
    isEnabled: (index) => items[index]?.isDisabled === false,
    onSelect: (index) => {
      const next = values[index];
      if (next !== undefined) onValueChange(next);
    },
  });

  // Composed rather than overwritten: spreading `props` over the arrow-key
  // handler would let a call site that only wanted to watch for Delete take
  // the whole keyboard away without ever noticing.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented) roving.handleKeyDown(event);
  };

  return (
    <ToggleGroupContext.Provider
      value={{
        value,
        select: onValueChange,
        variant,
        values,
        activeIndex: roving.activeIndex,
        itemRef: roving.itemRef,
      }}
    >
      <div
        role="radiogroup"
        data-slot="toggle-group"
        data-variant={variant}
        onKeyDown={handleKeyDown}
        className={cn(toggleGroupVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export type ToggleGroupItemProps = ComponentProps<"button"> & { readonly value: string };

export function ToggleGroupItem({
  value,
  className,
  children,
  onClick,
  ...props
}: ToggleGroupItemProps) {
  const group = useContext(ToggleGroupContext);
  if (!group) throw new Error("<ToggleGroupItem> must be rendered inside <ToggleGroup>.");

  const index = group.values.indexOf(value);
  const isOn = value === group.value;

  // An item the group could not see — wrapped in a Fragment or a tooltip —
  // keeps its own tab stop rather than becoming unreachable.
  const isRoving = index >= 0;
  const isIconOnly = Children.count(children) === 1 && isValidElement(children);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) group.select(value);
  };

  return (
    <button
      type="button"
      role="radio"
      ref={group.itemRef(index)}
      aria-checked={isOn}
      tabIndex={!isRoving || index === group.activeIndex ? 0 : -1}
      data-state={isOn ? "on" : "off"}
      onClick={handleClick}
      className={cn(
        toggleGroupItemVariants({
          variant: group.variant,
          state: isOn ? "on" : "off",
          shape: isIconOnly ? "square" : "auto",
        }),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { toggleGroupVariants, toggleGroupItemVariants };
