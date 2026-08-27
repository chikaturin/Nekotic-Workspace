"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
} from "react";
import { collectRovingItems, useRovingFocus } from "@/hooks/use-roving-focus";
import { cn } from "@/lib/utils";

/**
 * Tabs, built on `useRovingFocus` because `@radix-ui/react-tabs` is not a
 * dependency.
 *
 * The app had grown three tab strips: the record drawer's and the permission
 * dialog's were a byte-level copy of each other, and the notification tray's
 * was the same widget wearing a different skin. All three were `<button>`s in
 * a `role="tablist"` with no arrow keys and no roving tabindex, so a keyboard
 * user tabbed through every tab one at a time to reach the panel. Both skins
 * survive here as variants — the difference between a section switcher inside
 * a panel and a filter chip row is real — but the keyboard behaviour is now
 * written once.
 *
 * Controlled only. Every existing consumer already holds the active tab in its
 * own state, usually because a route or a parent needs to read it.
 */

const tabsListVariants = cva("flex items-center", {
  variants: {
    variant: {
      // The underline strip sits on a rule that runs the full width of its
      // container, so it owns the border and the triggers hang off it.
      underline: "shrink-0 gap-0.5 border-b border-border px-[var(--control-pad-md)]",
      pill: "gap-0.5",
    },
  },
  defaultVariants: { variant: "underline" },
});

const tabsTriggerVariants = cva(
  cn(
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap",
    "outline-none transition-[background-color,border-color,color] duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)]",
    "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        // -mb-px pulls the 2px indicator over the list's 1px rule so the two
        // read as one line rather than as a bar floating above a border.
        underline: "-mb-px h-[var(--control-lg)] border-b-2 px-[var(--control-pad-md)] text-ui",
        pill: "h-[var(--control-sm)] rounded-md px-[var(--control-pad-sm)] text-ui",
      },
      state: { active: "", inactive: "" },
    },
    compoundVariants: [
      {
        variant: "underline",
        state: "active",
        class: "border-accent font-medium text-foreground",
      },
      {
        variant: "underline",
        state: "inactive",
        class: "border-transparent text-muted-foreground hover:text-foreground",
      },
      { variant: "pill", state: "active", class: "bg-accent-soft text-accent" },
      {
        variant: "pill",
        state: "inactive",
        class: "text-muted-foreground hover:bg-hover hover:text-foreground",
      },
    ],
    defaultVariants: { variant: "underline", state: "inactive" },
  },
);

const tabsCountVariants = cva("metric rounded-full px-1 text-micro", {
  variants: {
    variant: { underline: "", pill: "" },
    state: { active: "", inactive: "" },
  },
  compoundVariants: [
    // A solid accent counter is right on a pill that is already tinted, and
    // far too loud next to an underline tab whose only mark is a hairline.
    { variant: "pill", state: "active", class: "bg-accent text-accent-foreground" },
    { variant: "underline", state: "active", class: "bg-accent-soft text-accent" },
    { state: "inactive", class: "bg-hover text-faint-foreground" },
  ],
  defaultVariants: { variant: "underline", state: "inactive" },
});

export type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>;

interface TabsContextValue {
  readonly value: string;
  readonly select: (value: string) => void;
  readonly variant: TabsVariant;
  readonly baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`<${component}> must be rendered inside <Tabs>.`);
  return context;
}

interface TabsListContextValue {
  readonly values: readonly string[];
  readonly activeIndex: number;
  readonly itemRef: (index: number) => RefCallback<HTMLElement>;
}

const TabsListContext = createContext<TabsListContextValue | null>(null);

export type TabsProps = ComponentProps<"div"> & {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly variant?: TabsVariant;
};

export function Tabs({
  value,
  onValueChange,
  variant = "underline",
  className,
  ...props
}: TabsProps) {
  // Ids are generated rather than derived from the tab values so two tab
  // strips with the same value names — "details" appears in three places —
  // cannot end up with colliding `aria-controls` targets on the same page.
  const baseId = useId();

  const context = useMemo(
    () => ({ value, select: onValueChange, variant, baseId }),
    [value, onValueChange, variant, baseId],
  );

  return (
    <TabsContext.Provider value={context}>
      <div data-slot="tabs" className={cn("flex min-h-0 flex-col", className)} {...props} />
    </TabsContext.Provider>
  );
}

/**
 * An accessible name is required, not optional: a screen reader announcing
 * "tab list" with no idea which one is the failure mode this exists to stop.
 */
export type TabsListProps = ComponentProps<"div"> & { readonly "aria-label": string };

export function TabsList({ className, children, onKeyDown, ...props }: TabsListProps) {
  const { value, select, variant } = useTabsContext("TabsList");

  const items = collectRovingItems(children);
  const values = items.map((item) => item.value);

  const roving = useRovingFocus({
    count: items.length,
    orientation: "horizontal",
    activeIndex: values.indexOf(value),
    isEnabled: (index) => items[index]?.isDisabled === false,
    onSelect: (index) => {
      const next = values[index];
      if (next !== undefined) select(next);
    },
  });

  // Composed rather than overwritten: spreading `props` over the arrow-key
  // handler would let a call site that only wanted to watch for Escape take
  // the whole keyboard away without ever noticing.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!event.defaultPrevented) roving.handleKeyDown(event);
  };

  return (
    <TabsListContext.Provider
      value={{ values, activeIndex: roving.activeIndex, itemRef: roving.itemRef }}
    >
      <div
        role="tablist"
        data-slot="tabs-list"
        data-variant={variant}
        onKeyDown={handleKeyDown}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    </TabsListContext.Provider>
  );
}

export type TabsTriggerProps = ComponentProps<"button"> & {
  readonly value: string;
  /** Rendered as a counter chip, and only when there is something to count. */
  readonly count?: number;
};

export function TabsTrigger({
  value,
  count,
  className,
  children,
  onClick,
  ...props
}: TabsTriggerProps) {
  const { value: selected, select, variant, baseId } = useTabsContext("TabsTrigger");

  const list = useContext(TabsListContext);
  if (!list) throw new Error("<TabsTrigger> must be rendered inside <TabsList>.");

  const index = list.values.indexOf(value);
  const isSelected = value === selected;
  const state = isSelected ? "active" : "inactive";

  // A trigger the list could not see — wrapped in a Fragment, or in a tooltip
  // component — keeps its own tab stop. Degrading to "reachable but not in the
  // roving order" is survivable; tabIndex -1 with nothing to rove to is not.
  const isRoving = index >= 0;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) select(value);
  };

  return (
    <button
      type="button"
      role="tab"
      ref={list.itemRef(index)}
      id={`${baseId}-tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={!isRoving || index === list.activeIndex ? 0 : -1}
      data-state={state}
      onClick={handleClick}
      className={cn(tabsTriggerVariants({ variant, state }), className)}
      {...props}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={tabsCountVariants({ variant, state })}>{count}</span>
      )}
    </button>
  );
}

export type TabsContentProps = ComponentProps<"div"> & { readonly value: string };

/**
 * Inactive panels unmount. These carry comment threads, activity feeds and
 * permission tables that each fetch on mount, so keeping all three alive
 * behind `hidden` would triple the work every time a drawer opens.
 */
export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const { value: selected, baseId } = useTabsContext("TabsContent");
  if (value !== selected) return null;

  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      // The panel takes a tab stop so that Tab out of the strip lands on the
      // content it just switched to, including when that content is a static
      // block with nothing focusable in it.
      tabIndex={0}
      className={cn(
        "min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export { tabsListVariants, tabsTriggerVariants };
