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

const toggleGroupVariants = cva("", {
  variants: {
    variant: {
      segmented: "inline-flex items-center rounded-md border border-border bg-surface p-0.5",
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
    activeIndex: values.indexOf(value),
    isEnabled: (index) => items[index]?.isDisabled === false,
    onSelect: (index) => {
      const next = values[index];
      if (next !== undefined) onValueChange(next);
    },
  });

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
