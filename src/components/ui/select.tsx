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

export type SelectSize = ListboxSize;
export type SelectVariant = "default" | "ghost";

const NO_OPTIONS: readonly ListboxOption[] = [];
const NO_VALUES: readonly string[] = [];

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
  readonly onValueChange: (value: string | null) => void;
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

    if (event.key === " " || event.key === "Tab") {
      const option = keyboard.activeOption;
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

export interface MultiSelectProps extends SelectBaseProps {
  readonly values: readonly string[];
  readonly onValuesChange: (values: readonly string[]) => void;
  readonly maxVisibleChips?: number;
}

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

    if (event.key === " ") {
      event.preventDefault();
      const option = keyboard.activeOption;
      if (option) toggle(option);
      return;
    }

    keyboard.handleKeyDown(event);
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLElement>) {
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
