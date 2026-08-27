"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown, Lock, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { inputVariants } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SELECT_SOLID_CLASSES } from "@/lib/board-schema";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

/**
 * The substrate every pick-one-of-many surface in the app is built from.
 *
 * Four surfaces hand-rolled `role="listbox"` before this file existed — the
 * select cell, the user cell, the mention picker and the slash menu — and each
 * one arrived at a slightly different row: different padding, a different
 * highlight colour, three spellings of "nothing matched" and only one of them
 * bothered to explain a disabled option. Nothing here decides *what* is in a
 * list; it decides only how a row of one reads, so that a status option, a
 * teammate and a block type look like members of the same family.
 *
 * The keyboard lives in `useListboxKeyboard` (`hooks/use-roving-focus`), not
 * here: DOM focus stays on the trigger or the search field and only a
 * highlight moves, so a row is never focused and never needs to be focusable.
 */

export type ListboxSize = "xs" | "sm" | "md";

export interface ListboxOption {
  /** Stable identity. What `onValueChange` hands back, and what keys the row. */
  readonly value: string;
  readonly label: string;
  /** Second line. The "what this means" a bare label cannot carry. */
  readonly description?: string;
  readonly icon?: LucideIcon;
  /** A status colour, drawn as the leading dot. Shares the board palette. */
  readonly color?: SelectColor;
  readonly avatarUrl?: string;
  readonly isDisabled?: boolean;
  /**
   * Why this option cannot be picked, in the user's words.
   *
   * Not optional in spirit: a disabled row that does nothing on click reads as
   * a broken control rather than a rule, so the reason is rendered in place of
   * the description and repeated in the row's `title` for when it truncates.
   */
  readonly disabledReason?: string;
}

/* ------------------------------------------------------------------ helpers */

/** A disabled option is still offered — it just cannot be taken. */
export function isListboxOptionEnabled(option: ListboxOption): boolean {
  return option.isDisabled !== true;
}

export function findListboxOption(
  options: readonly ListboxOption[],
  value: string | null | undefined,
): ListboxOption | null {
  if (value === null || value === undefined) return null;
  return options.find((option) => option.value === value) ?? null;
}

/**
 * Substring match over the label and the description.
 *
 * Deliberately not fuzzy. This is the filter for a short, known list where the
 * user is typing the first letters of something they can already see; `cmdk`'s
 * scoring is the right tool for the long-list case and `Combobox` uses it.
 */
export function filterListboxOptions(
  options: readonly ListboxOption[],
  query: string,
): readonly ListboxOption[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return options;

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      (option.description?.toLowerCase().includes(needle) ?? false),
  );
}

const ID_UNSAFE_CHARS = /\s+/g;

/**
 * The DOM id of one row, so `aria-activedescendant` can point at it.
 *
 * Whitespace is stripped because an option value is free-form application data
 * — a folder name, an email — and an id containing a space cannot be
 * referenced from an IDREF attribute, which fails silently rather than loudly.
 */
export function listboxOptionId(listboxId: string, value: string): string {
  return `${listboxId}-option-${value.replace(ID_UNSAFE_CHARS, "_")}`;
}

/* ---------------------------------------------------------------- container */

export function Listbox({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="listbox"
      role="listbox"
      className={cn(
        // `overscroll-contain` is the difference between a list that stops at
        // its own end and one that hands the wheel to the page behind it,
        // which scrolls the dialog out from under an open dropdown.
        "max-h-64 overflow-y-auto overscroll-contain p-1",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Non-option children of a listbox — headings, empty and loading states — are
 * marked `presentation` so assistive technology does not count them as options
 * and announce "1 of 3" for a list holding one real choice.
 */
export function ListboxGroupLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="presentation"
      className={cn(
        "px-2 pb-1 pt-2 text-micro font-semibold uppercase tracking-wider text-faint-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function ListboxEmpty({
  className,
  children = "No matches.",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      role="presentation"
      className={cn("px-2 py-6 text-center text-body text-muted-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ListboxLoadingProps extends ComponentProps<"div"> {
  readonly label?: string;
}

export function ListboxLoading({
  className,
  label = "Loading options…",
  ...props
}: ListboxLoadingProps) {
  return (
    <div
      role="presentation"
      className={cn(
        "flex items-center justify-center gap-2 px-2 py-6 text-body text-muted-foreground",
        className,
      )}
      {...props}
    >
      {/* The label beside it is the announcement, so the spinner stays silent
          rather than duplicating it. */}
      <Spinner size="sm" />
      {label}
    </div>
  );
}

/* --------------------------------------------------------------------- rows */

const listboxRowVariants = cva(
  [
    "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md text-left outline-none transition-colors",
    "text-foreground",
    // Two spellings of the same state on purpose. `data-active` is what this
    // file's own rows carry; `data-selected` is what `cmdk` stamps on the row
    // its keyboard is sitting on. Listing both is what lets one row style
    // serve the Select's listbox and the Combobox's command list, instead of
    // the two drifting apart the moment either is touched.
    "hover:bg-hover data-[active=true]:bg-hover data-[selected=true]:bg-hover",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-[var(--disabled-opacity)]",
    "aria-disabled:hover:bg-transparent",
    "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-[var(--disabled-opacity)]",
    "data-[disabled=true]:hover:bg-transparent",
  ],
  {
    variants: {
      size: {
        xs: "min-h-[var(--control-xs)] px-1.5 py-1 text-body",
        sm: "min-h-[var(--control-sm)] px-2 py-1 text-ui",
        md: "min-h-[var(--control-md)] px-2 py-1.5 text-ui",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

export type ListboxRowVariants = VariantProps<typeof listboxRowVariants>;

const INITIALS_LENGTH = 2;

function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, INITIALS_LENGTH)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * The status palette at full strength, borrowed rather than copied.
 *
 * A second colour map here is how the dot in the dropdown ends up a different
 * blue from the chip in the cell it writes to — the board owns these tokens,
 * so the board's map is the one that gets read.
 */
const SELECT_COLOR_DOT = SELECT_SOLID_CLASSES;

export interface ListboxOptionVisualProps {
  readonly option: ListboxOption;
  readonly size?: ListboxSize;
  readonly className?: string;
}

/**
 * The one glyph in front of a row — and in front of the trigger's own value,
 * which is why it is exported rather than inlined into the row.
 *
 * Exactly one of avatar, icon and colour dot is drawn, in that order. An
 * option carrying two of them is a mistake at the call site, and rendering
 * both would make a 24px row 40px wide before the label even starts; picking
 * the most specific one keeps every row in a list the same shape.
 */
export function ListboxOptionVisual({
  option,
  size = "sm",
  className,
}: ListboxOptionVisualProps) {
  if (option.avatarUrl !== undefined) {
    // The `size` prop, not a className: Avatar publishes its size through
    // context so the fallback initials scale with the circle. Setting the
    // diameter by class shrinks the ring and leaves 11px initials inside a
    // 16px avatar — the exact mismatch the size ladder exists to stop.
    return (
      <Avatar size={size} className={className}>
        <AvatarImage src={option.avatarUrl} alt="" />
        <AvatarFallback>{initialsOf(option.label)}</AvatarFallback>
      </Avatar>
    );
  }

  if (option.icon !== undefined) {
    const Icon = option.icon;
    return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
  }

  if (option.color !== undefined) {
    return (
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", SELECT_COLOR_DOT[option.color], className)}
      />
    );
  }

  return null;
}

export interface ListboxOptionContentProps {
  readonly option: ListboxOption;
  readonly isSelected?: boolean;
  readonly size?: ListboxSize;
  /** Slotted before the lock and the check — a shortcut hint, a count. */
  readonly trailing?: ReactNode;
}

/**
 * A row's insides without the row.
 *
 * Split out because the Combobox's rows are `cmdk`'s `CommandItem`s, which
 * already supply the element and the `role="option"`. Nesting this file's row
 * inside one would give a single option two option roles; sharing the content
 * instead is what keeps a Select row and a Combobox row identical.
 */
export function ListboxOptionContent({
  option,
  isSelected = false,
  size = "sm",
  trailing,
}: ListboxOptionContentProps) {
  const isDisabled = option.isDisabled === true;
  // The reason outranks the description: when an option cannot be taken, why
  // not is the only line the user still needs. It is also a shade brighter
  // than a description, because it is the more important of the two.
  const secondary = isDisabled ? option.disabledReason ?? option.description : option.description;

  return (
    <>
      <ListboxOptionVisual option={option} size={size} />

      <span className="min-w-0 flex-1">
        <span className="block truncate">{option.label}</span>
        {secondary !== undefined && (
          <span
            className={cn(
              "block truncate text-body",
              isDisabled && option.disabledReason !== undefined
                ? "text-muted-foreground"
                : "text-faint-foreground",
            )}
          >
            {secondary}
          </span>
        )}
      </span>

      {trailing}

      {isDisabled && <Lock aria-hidden="true" className="size-3 shrink-0 text-faint-foreground" />}
      {isSelected && <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent" />}
    </>
  );
}

/**
 * Keeps the highlighted row inside the scroll port.
 *
 * `block: "nearest"` scrolls only when the row is actually out of view, so
 * arrowing through the visible middle of a list does not jerk it around. The
 * ref is read from an effect rather than during render, which is both correct
 * and what the React Compiler rules require.
 */
function useScrollIntoViewWhenActive(isActive: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [isActive]);

  return ref;
}

export interface ListboxOptionRowProps {
  readonly option: ListboxOption;
  /** Build it with `listboxOptionId` so the trigger can point at this row. */
  readonly id?: string;
  readonly isSelected?: boolean;
  /** The keyboard highlight. At most one row in a list carries it. */
  readonly isActive?: boolean;
  readonly size?: ListboxSize;
  readonly onSelect?: (option: ListboxOption) => void;
  readonly onHighlight?: (option: ListboxOption) => void;
  readonly trailing?: ReactNode;
  readonly className?: string;
}

export function ListboxOptionRow({
  option,
  id,
  isSelected = false,
  isActive = false,
  size = "sm",
  onSelect,
  onHighlight,
  trailing,
  className,
}: ListboxOptionRowProps) {
  const isDisabled = option.isDisabled === true;
  const ref = useScrollIntoViewWhenActive(isActive);

  return (
    <div
      ref={ref}
      id={id}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled || undefined}
      data-active={isActive ? "true" : undefined}
      title={isDisabled ? option.disabledReason : undefined}
      // The trigger — or the search field — owns DOM focus for the whole
      // widget, and a click that moved focus to the row would close the
      // popover out from under the click that opened it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (isDisabled) return;
        onSelect?.(option);
      }}
      onMouseEnter={() => onHighlight?.(option)}
      className={cn(listboxRowVariants({ size }), className)}
    >
      <ListboxOptionContent
        option={option}
        isSelected={isSelected}
        size={size}
        trailing={trailing}
      />
    </div>
  );
}

export interface ListboxClearButtonProps {
  readonly label: string;
  readonly onClear: () => void;
  readonly className?: string;
}

/**
 * The X that empties a trigger.
 *
 * It stops its own events rather than letting them bubble: the trigger opens
 * on click, so without this every clear is immediately followed by an open
 * dropdown sitting over the field the user just emptied.
 */
export function ListboxClearButton({ label, onClear, className }: ListboxClearButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClear();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-sm text-faint-foreground outline-none transition-colors",
        "hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X aria-hidden="true" className="size-3" />
    </button>
  );
}

/* ------------------------------------------------------------------ trigger */

export interface ListboxTriggerProps
  extends Omit<ComponentProps<"div">, "role" | "tabIndex" | "children"> {
  readonly isOpen: boolean;
  readonly isDisabled?: boolean;
  /** Swaps the chevron for a spinner while the options are still arriving. */
  readonly isLoading?: boolean;
  readonly size?: ListboxSize;
  readonly variant?: "default" | "ghost";
  /**
   * The element this trigger opens. Wired to `aria-controls` only while open,
   * because an `aria-controls` pointing at something not in the document is a
   * dangling reference — and a listbox that has not mounted yet is exactly
   * that. Pass the listbox's own id where there is one; pass the popover's
   * where the popup is a composite of a search field and a list.
   */
  readonly popupId?: string;
  /** What the popup is. A bare list is a listbox; a search-plus-list is not. */
  readonly popupRole?: "listbox" | "dialog";
  /**
   * The highlighted row's id — pass it only when this trigger is the element
   * holding DOM focus. A searchable list moves focus into its own search
   * field, and the pointer has to travel with it or a screen reader announces
   * the highlight against an element the user is no longer standing on.
   */
  readonly activeDescendantId?: string;
  /** Sits between the value and the chevron: a clear button, a count. */
  readonly trailing?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * The control you click to open a list, wearing `Input`'s shell.
 *
 * It is a `div` with `role="combobox"`, not a `<button>`, and that is a
 * decision rather than an oversight: a multi-select renders its values as
 * removable chips and a clearable select renders an X, both of which are
 * buttons, and interactive content nested inside a `<button>` is invalid HTML
 * that assistive technology flattens into one unusable control. Every key a
 * button would have given us for free — Enter, Space — is handled explicitly
 * by the widget above, so nothing is lost but the nesting problem.
 *
 * The ARIA attributes are written *after* the prop spread rather than before
 * it. `Popover.Trigger asChild` merges its own `aria-haspopup="dialog"` and
 * `aria-controls` onto whatever it wraps, and a select whose trigger claims to
 * open a dialog is announced as the wrong widget entirely.
 */
export function ListboxTrigger({
  isOpen,
  isDisabled = false,
  isLoading = false,
  size = "md",
  variant = "default",
  popupId,
  popupRole = "listbox",
  activeDescendantId,
  trailing,
  children,
  className,
  ...props
}: ListboxTriggerProps) {
  return (
    <div
      {...props}
      data-slot="listbox-trigger"
      role="combobox"
      aria-haspopup={popupRole}
      aria-expanded={isOpen}
      aria-controls={isOpen && popupId !== undefined ? popupId : undefined}
      aria-activedescendant={isOpen ? activeDescendantId : undefined}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : 0}
      data-state={isOpen ? "open" : "closed"}
      className={cn(
        inputVariants({ variant, size }),
        "group items-center gap-1.5",
        // `disabled:` is a pseudo-class the `Input` shell can rely on and a
        // div cannot, so the same two effects are restated against the ARIA
        // state. `pointer-events-none` is the load-bearing half: the popover
        // trigger's own click handler is composed onto this element and would
        // otherwise still open the list.
        isDisabled && "pointer-events-none opacity-[var(--disabled-opacity)]",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>

      {trailing}

      {isLoading ? (
        <Spinner size="sm" className="text-faint-foreground" />
      ) : (
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 shrink-0 text-faint-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
        />
      )}
    </div>
  );
}

export { listboxRowVariants };
