"use client";

import { Search } from "lucide-react";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  filterListboxOptions,
  findListboxOption,
  isListboxOptionEnabled,
  Listbox,
  ListboxClearButton,
  ListboxEmpty,
  ListboxLoading,
  ListboxOptionRow,
  ListboxOptionVisual,
  ListboxTrigger,
  listboxOptionId,
  type ListboxOption,
  type ListboxSize,
} from "@/components/ui/listbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useListboxKeyboard } from "@/hooks/use-roving-focus";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

/**
 * The rich Select, and its multi-value twin.
 *
 * This stands *beside* `SelectField`, the native one, and does not replace it:
 * a plain list of words is better served by a real `<select>`, which brings
 * the platform's own keyboard, its mobile picker and its accessibility for
 * free. What a native `<option>` cannot hold is an icon, a colour swatch, a
 * second line of description or an avatar — and board configuration and
 * permissions need all four. The column dialog's colour picker is the proof:
 * it paints the option palette onto the `<select>` element itself, because
 * there is nowhere else to put it, and the swatch it is trying to show never
 * appears in the popup the browser draws.
 *
 * Two things here are load-bearing:
 *
 * 1. Nothing about the list is built while the select is shut. The options are
 *    not filtered, no row is constructed, and the popover's contents are one
 *    unrendered element. These live inside virtualised grid cells, where a few
 *    hundred closed selects can be mounted at once and any per-option work on
 *    the closed path is paid several hundred times per scroll frame.
 *
 * 2. `aria-activedescendant` follows DOM focus. It sits on the trigger while
 *    the trigger is focused and on the search field once focus moves there;
 *    announcing a highlight against an element the user is not on is the same
 *    as not announcing it.
 */

export type SelectSize = ListboxSize;
export type SelectVariant = "default" | "ghost";

/** Stable empty arrays, so the closed path allocates nothing at all. */
const NO_OPTIONS: readonly ListboxOption[] = [];
const NO_VALUES: readonly string[] = [];

/**
 * A trigger holding chips has to grow with them, so its fixed height is
 * swapped for a floor. `h-auto` wins over the shell's `h-*` through
 * tailwind-merge; the `min-h-*` beside it is what keeps an empty MultiSelect
 * exactly as tall as the Select next to it.
 */
const MULTI_TRIGGER_HEIGHT: Readonly<Record<SelectSize, string>> = {
  xs: "h-auto min-h-[var(--control-xs)]",
  sm: "h-auto min-h-[var(--control-sm)]",
  md: "h-auto min-h-[var(--control-md)]",
};

const MAX_VISIBLE_CHIPS = 4;

interface SelectBaseProps {
  readonly options: readonly ListboxOption[];
  readonly placeholder?: string;
  readonly size?: SelectSize;
  readonly variant?: SelectVariant;
  /** Adds a search field inside the dropdown and moves focus into it. */
  readonly isSearchable?: boolean;
  readonly isClearable?: boolean;
  readonly isLoading?: boolean;
  readonly isDisabled?: boolean;
  readonly emptyMessage?: ReactNode;
  readonly searchPlaceholder?: string;
  readonly align?: "start" | "center" | "end";
  readonly id?: string;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "true" | "false";
  readonly "aria-required"?: boolean;
}

export interface SelectProps extends SelectBaseProps {
  readonly value: string | null;
  /**
   * Symmetric with `value`, which is why it takes `null`: a clearable select
   * has no value to report once it is cleared, and a second `onClear` callback
   * would be one more thing that can disagree with this one.
   */
  readonly onValueChange: (value: string | null) => void;
  /** Owns the trigger's whole value area — a chip, a breadcrumb, a preview. */
  readonly renderValue?: (option: ListboxOption | null) => ReactNode;
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  size = "md",
  variant = "default",
  isSearchable = false,
  isClearable = false,
  isLoading = false,
  isDisabled = false,
  renderValue,
  emptyMessage = "No matches.",
  searchPlaceholder = "Search…",
  align = "start",
  id,
  className,
  contentClassName,
  ...aria
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  const selectedOption = useMemo(() => findListboxOption(options, value), [options, value]);

  // The closed path in one expression: no filtering, no allocation, and a
  // keyboard hook that walks an empty array in constant time.
  const visibleOptions = useMemo(() => {
    if (!isOpen) return NO_OPTIONS;
    return isSearchable ? filterListboxOptions(options, query) : options;
  }, [isOpen, isSearchable, options, query]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (option: ListboxOption) => {
      if (!isListboxOptionEnabled(option)) return;
      onValueChange(option.value);
      close();
    },
    [onValueChange, close],
  );

  const keyboard = useListboxKeyboard<ListboxOption>({
    options: visibleOptions,
    onSelect: commit,
    onClose: close,
    isOpen,
    isOptionEnabled: isListboxOptionEnabled,
    resetKey: query,
  });

  function handleOpenChange(next: boolean) {
    if (isDisabled) return;

    if (!next) {
      setIsOpen(false);
      setQuery("");
      return;
    }

    setIsOpen(true);

    // Open onto the current selection rather than the top of the list. The
    // query is always empty at this point — it is cleared on close, not on
    // open — so the index into `options` is the index into the visible rows,
    // and the highlight the hook stores under the empty query still matches.
    const index = options.findIndex((option) => option.value === value);
    if (index >= 0) keyboard.setActiveIndex(index);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isDisabled) return;

    if (!isOpen) {
      if (isOpeningKey(event.key)) {
        event.preventDefault();
        handleOpenChange(true);
      }
      return;
    }

    // Only reached by the non-searchable select: once there is a search field
    // it has focus, and it runs the same handler from inside the popover.
    if (event.key === " " || event.key === "Tab") {
      const option = keyboard.activeOption;
      // Tab commits and moves on, the way a native select does; Space commits
      // and stays. Both are taken over so neither reaches the page as a scroll
      // or as a tab through a popover the user thinks they just answered.
      if (event.key === " ") event.preventDefault();
      if (option) commit(option);
      return;
    }

    keyboard.handleKeyDown(event);
  }

  const activeDescendantId =
    keyboard.activeOption === null
      ? undefined
      : listboxOptionId(listboxId, keyboard.activeOption.value);

  const canClear = isClearable && !isDisabled && value !== null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ListboxTrigger
          ref={triggerRef}
          id={id}
          isOpen={isOpen}
          isDisabled={isDisabled}
          isLoading={isLoading}
          size={size}
          variant={variant}
          popupId={listboxId}
          activeDescendantId={isSearchable ? undefined : activeDescendantId}
          onKeyDown={handleTriggerKeyDown}
          className={className}
          trailing={
            canClear ? (
              <ListboxClearButton label="Clear selection" onClear={() => onValueChange(null)} />
            ) : undefined
          }
          {...aria}
        >
          {renderValue !== undefined ? (
            renderValue(selectedOption)
          ) : selectedOption === null ? (
            <span className="truncate text-faint-foreground">{placeholder}</span>
          ) : (
            <>
              <ListboxOptionVisual option={selectedOption} size={size} />
              <span className="truncate">{selectedOption.label}</span>
            </>
          )}
        </ListboxTrigger>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        // Keeping focus on the trigger is what makes `aria-activedescendant`
        // on the trigger true. The searchable variant wants the opposite, and
        // lets Radix move focus into the search field it renders first.
        onOpenAutoFocus={isSearchable ? undefined : (event) => event.preventDefault()}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden p-0",
          contentClassName,
        )}
      >
        <SelectPanel
          listboxId={listboxId}
          label={aria["aria-label"]}
          options={visibleOptions}
          selectedValues={value === null ? NO_VALUES : [value]}
          activeValue={keyboard.activeOption?.value ?? null}
          size={size}
          isSearchable={isSearchable}
          isLoading={isLoading}
          query={query}
          onQueryChange={setQuery}
          onKeyDown={keyboard.handleKeyDown}
          onSelect={commit}
          onHighlight={keyboard.setActiveIndex}
          emptyMessage={emptyMessage}
          searchPlaceholder={searchPlaceholder}
          activeDescendantId={activeDescendantId}
        />
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------- MultiSelect */

export interface MultiSelectProps extends SelectBaseProps {
  readonly values: readonly string[];
  readonly onValuesChange: (values: readonly string[]) => void;
  /** How many chips fit before the rest collapse into a “+n” badge. */
  readonly maxVisibleChips?: number;
}

/**
 * The same machine with the list left open between picks.
 *
 * Closing after every choice is the single biggest reason people mis-use a
 * multi-select: it looks like it took one answer and threw the question away.
 * The search field lives in the dropdown rather than in the trigger so the
 * chips keep the whole width of the control they belong to.
 */
export function MultiSelect({
  options,
  values,
  onValuesChange,
  placeholder = "Select…",
  size = "md",
  variant = "default",
  isSearchable = true,
  isClearable = false,
  isLoading = false,
  isDisabled = false,
  maxVisibleChips = MAX_VISIBLE_CHIPS,
  emptyMessage = "No matches.",
  searchPlaceholder = "Search…",
  align = "start",
  id,
  className,
  contentClassName,
  ...aria
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  const selectedOptions = useMemo(
    () =>
      values
        .map((value) => findListboxOption(options, value))
        .filter((option): option is ListboxOption => option !== null),
    [values, options],
  );

  const visibleOptions = useMemo(() => {
    if (!isOpen) return NO_OPTIONS;
    return isSearchable ? filterListboxOptions(options, query) : options;
  }, [isOpen, isSearchable, options, query]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(
    (option: ListboxOption) => {
      if (!isListboxOptionEnabled(option)) return;

      onValuesChange(
        values.includes(option.value)
          ? values.filter((value) => value !== option.value)
          : [...values, option.value],
      );
    },
    [values, onValuesChange],
  );

  /**
   * Removal is not `toggle` with the value already in it.
   *
   * An option can be switched off in configuration long after somebody picked
   * it, and routing the chip's X through `toggle` would refuse to take it back
   * — leaving a value on the record that the record is no longer allowed to
   * hold, and no way to remove it. Taking something away is always permitted.
   */
  const remove = useCallback(
    (value: string) => onValuesChange(values.filter((current) => current !== value)),
    [values, onValuesChange],
  );

  const keyboard = useListboxKeyboard<ListboxOption>({
    options: visibleOptions,
    onSelect: toggle,
    onClose: close,
    isOpen,
    isOptionEnabled: isListboxOptionEnabled,
    resetKey: query,
  });

  function handleOpenChange(next: boolean) {
    if (isDisabled) return;
    setIsOpen(next);
    if (!next) setQuery("");
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isDisabled) return;

    if (!isOpen) {
      if (isOpeningKey(event.key)) {
        event.preventDefault();
        handleOpenChange(true);
      }
      return;
    }

    // Space toggles the highlighted row, the same as Enter. Left alone it
    // would reach the page as a scroll, which yanks the open list off screen.
    if (event.key === " ") {
      event.preventDefault();
      const option = keyboard.activeOption;
      if (option) toggle(option);
      return;
    }

    keyboard.handleKeyDown(event);
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Backspace on an empty query drops the last chip. It is the one gesture
    // people try unprompted in a field full of tokens, and without it the only
    // way back out of a mistake is to find the row again in the list.
    if (event.key === "Backspace" && query.length === 0 && values.length > 0) {
      onValuesChange(values.slice(0, -1));
      return;
    }

    keyboard.handleKeyDown(event);
  }

  const activeDescendantId =
    keyboard.activeOption === null
      ? undefined
      : listboxOptionId(listboxId, keyboard.activeOption.value);

  const overflowCount = selectedOptions.length - maxVisibleChips;
  const canClear = isClearable && !isDisabled && values.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ListboxTrigger
          ref={triggerRef}
          id={id}
          isOpen={isOpen}
          isDisabled={isDisabled}
          isLoading={isLoading}
          size={size}
          variant={variant}
          popupId={listboxId}
          activeDescendantId={isSearchable ? undefined : activeDescendantId}
          onKeyDown={handleTriggerKeyDown}
          className={cn(MULTI_TRIGGER_HEIGHT[size], "flex-wrap py-1", className)}
          trailing={
            canClear ? (
              <ListboxClearButton label="Clear all selections" onClear={() => onValuesChange(NO_VALUES)} />
            ) : undefined
          }
          {...aria}
        >
          {selectedOptions.length === 0 ? (
            <span className="truncate text-faint-foreground">{placeholder}</span>
          ) : (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {selectedOptions.slice(0, maxVisibleChips).map((option) => (
                <Chip
                  key={option.value}
                  size="xs"
                  color={option.color}
                  leading={<ListboxOptionVisual option={option} size="xs" />}
                  // The trigger is a button: a mousedown on the remove glyph
                  // would otherwise reach it and reopen the popup the click
                  // just closed.
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  {...(isDisabled ? {} : { onRemove: () => remove(option.value) })}
                >
                  {option.label}
                </Chip>
              ))}
              {overflowCount > 0 && (
                <span className="shrink-0 text-body text-muted-foreground">+{overflowCount}</span>
              )}
            </span>
          )}
        </ListboxTrigger>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        onOpenAutoFocus={isSearchable ? undefined : (event) => event.preventDefault()}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden p-0",
          contentClassName,
        )}
      >
        <SelectPanel
          listboxId={listboxId}
          label={aria["aria-label"]}
          options={visibleOptions}
          selectedValues={values}
          activeValue={keyboard.activeOption?.value ?? null}
          size={size}
          isMultiple
          isSearchable={isSearchable}
          isLoading={isLoading}
          query={query}
          onQueryChange={setQuery}
          onKeyDown={handlePanelKeyDown}
          onSelect={toggle}
          onHighlight={keyboard.setActiveIndex}
          emptyMessage={emptyMessage}
          searchPlaceholder={searchPlaceholder}
          activeDescendantId={activeDescendantId}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------------- internals */

const OPENING_KEYS: readonly string[] = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "];

function isOpeningKey(key: string): boolean {
  return OPENING_KEYS.includes(key);
}

interface SelectPanelProps {
  readonly listboxId: string;
  readonly label?: string;
  readonly options: readonly ListboxOption[];
  readonly selectedValues: readonly string[];
  readonly activeValue: string | null;
  readonly size: SelectSize;
  readonly isMultiple?: boolean;
  readonly isSearchable: boolean;
  readonly isLoading: boolean;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onSelect: (option: ListboxOption) => void;
  readonly onHighlight: (index: number) => void;
  readonly emptyMessage: ReactNode;
  readonly searchPlaceholder: string;
  readonly activeDescendantId: string | undefined;
}

/**
 * Everything behind the popover, in its own component on purpose.
 *
 * `PopoverContent` renders nothing while closed, but JSX children are built
 * eagerly: written inline, one element per option would be allocated on every
 * render of every closed Select on the page. One `<SelectPanel/>` element is
 * allocated instead, and this function does not run until the list is open.
 */
function SelectPanel({
  listboxId,
  label,
  options,
  selectedValues,
  activeValue,
  size,
  isMultiple = false,
  isSearchable,
  isLoading,
  query,
  onQueryChange,
  onKeyDown,
  onSelect,
  onHighlight,
  emptyMessage,
  searchPlaceholder,
  activeDescendantId,
}: SelectPanelProps) {
  return (
    <>
      {isSearchable && (
        <div className="flex items-center gap-2 border-b border-border px-2">
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />
          <input
            type="text"
            role="combobox"
            aria-expanded
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={activeDescendantId}
            aria-label={searchPlaceholder}
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-[var(--control-sm)] w-full min-w-0 bg-transparent text-ui text-foreground outline-none placeholder:text-faint-foreground"
          />
        </div>
      )}

      <Listbox
        id={listboxId}
        aria-label={label}
        aria-multiselectable={isMultiple || undefined}
      >
        {isLoading ? (
          <ListboxLoading />
        ) : options.length === 0 ? (
          <ListboxEmpty>{emptyMessage}</ListboxEmpty>
        ) : (
          options.map((option, index) => (
            <ListboxOptionRow
              key={option.value}
              id={listboxOptionId(listboxId, option.value)}
              option={option}
              size={size}
              isSelected={selectedValues.includes(option.value)}
              isActive={option.value === activeValue}
              onSelect={onSelect}
              onHighlight={() => onHighlight(index)}
            />
          ))
        )}
      </Listbox>
    </>
  );
}
