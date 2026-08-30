"use client";

import { Plus } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle, type DialogSize } from "@/components/ui/dialog";
import {
  findListboxOption,
  ListboxClearButton,
  ListboxLoading,
  ListboxOptionContent,
  ListboxOptionVisual,
  ListboxTrigger,
  listboxRowVariants,
  type ListboxOption,
  type ListboxSize,
} from "@/components/ui/listbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ComboboxSize = ListboxSize;

const CREATE_ITEM_VALUE = "__combobox_create__";

function defaultCreateLabel(query: string): string {
  return `Create “${query}”`;
}

export interface ComboboxProps {
  readonly options: readonly ListboxOption[];
  readonly value: string | null;
  readonly onValueChange: (value: string | null) => void;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyMessage?: ReactNode;
  readonly size?: ComboboxSize;
  readonly variant?: "default" | "ghost";
  readonly isClearable?: boolean;
  readonly isLoading?: boolean;
  readonly isDisabled?: boolean;
  readonly onCreate?: (label: string) => void | Promise<void>;
  readonly createLabel?: (query: string) => string;
  readonly renderValue?: (option: ListboxOption | null) => ReactNode;
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

const OPENING_KEYS: readonly string[] = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "];

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  size = "md",
  variant = "default",
  isClearable = false,
  isLoading = false,
  isDisabled = false,
  onCreate,
  createLabel = defaultCreateLabel,
  renderValue,
  align = "start",
  id,
  className,
  contentClassName,
  ...aria
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const reactId = useId();
  const popupId = `${reactId}-popup`;

  const selectedOption = useMemo(() => findListboxOption(options, value), [options, value]);

  const trimmedQuery = query.trim();

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setCreateError(null);
  }, []);

  function handleOpenChange(next: boolean) {
    if (isDisabled) return;
    if (next) {
      setIsOpen(true);
      return;
    }
    close();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isDisabled || isOpen) return;

    if (OPENING_KEYS.includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function choose(option: ListboxOption) {
    if (option.isDisabled === true) return;
    onValueChange(option.value);
    close();
    triggerRef.current?.focus();
  }

  async function create() {
    if (onCreate === undefined || trimmedQuery.length === 0) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      await onCreate(trimmedQuery);
      close();
      triggerRef.current?.focus();
    } catch (error: unknown) {
      setCreateError(
        error instanceof Error ? error.message : `“${trimmedQuery}” could not be created.`,
      );
    } finally {
      setIsCreating(false);
    }
  }

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
          popupId={popupId}
          popupRole="dialog"
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
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden p-0",
          contentClassName,
        )}
      >
        <ComboboxPanel
          popupId={popupId}
          label={typeof aria["aria-label"] === "string" ? aria["aria-label"] : searchPlaceholder}
          searchPlaceholder={searchPlaceholder}
          query={query}
          onQueryChange={setQuery}
          trimmedQuery={trimmedQuery}
          options={options}
          value={value}
          size={size}
          isLoading={isLoading}
          isCreating={isCreating}
          createError={createError}
          emptyMessage={emptyMessage}
          createLabel={createLabel}
          onChoose={choose}
          onCreate={onCreate === undefined ? undefined : create}
        />
      </PopoverContent>
    </Popover>
  );
}

function keywordsOf(option: ListboxOption): string[] {
  return option.description === undefined
    ? [option.label]
    : [option.label, option.description];
}

export interface CommandDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly size?: DialogSize;
  readonly shouldFilter?: boolean;
  readonly loop?: boolean;
  readonly className?: string;
}

export function CommandDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  size = "xl",
  shouldFilter = true,
  loop = true,
  className,
}: CommandDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size={size} hideClose className={cn("overflow-hidden p-0", className)}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <Command label={title} shouldFilter={shouldFilter} loop={loop}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

interface ComboboxPanelProps {
  readonly popupId: string;
  readonly label: string;
  readonly searchPlaceholder: string;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly trimmedQuery: string;
  readonly options: readonly ListboxOption[];
  readonly value: string | null;
  readonly size: ListboxSize;
  readonly isLoading: boolean;
  readonly isCreating: boolean;
  readonly createError: string | null;
  readonly emptyMessage: ReactNode;
  readonly createLabel: (query: string) => string;
  readonly onChoose: (option: ListboxOption) => void;
  readonly onCreate?: () => void | Promise<void>;
}

function ComboboxPanel({
  popupId,
  label,
  searchPlaceholder,
  query,
  onQueryChange,
  trimmedQuery,
  options,
  value,
  size,
  isLoading,
  isCreating,
  createError,
  emptyMessage,
  createLabel,
  onChoose,
  onCreate,
}: ComboboxPanelProps) {
  const canCreate =
    onCreate !== undefined &&
    trimmedQuery.length > 0 &&
    !options.some((option) => option.label.trim().toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <Command id={popupId} label={label} loop>
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder={searchPlaceholder}
        className="h-[var(--control-sm)] text-ui"
      />

      <CommandList className="max-h-64 p-1">
        {isLoading ? (
          <ListboxLoading />
        ) : (
          <>
            {!canCreate && (
              <CommandEmpty className="px-2 py-6 text-center text-body text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>
            )}

            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                keywords={keywordsOf(option)}
                disabled={option.isDisabled}
                onSelect={() => onChoose(option)}
                className={listboxRowVariants({ size })}
              >
                <ListboxOptionContent
                  option={option}
                  size={size}
                  isSelected={option.value === value}
                />
              </CommandItem>
            ))}

            {canCreate && (
              <CommandItem
                forceMount
                value={CREATE_ITEM_VALUE}
                disabled={isCreating}
                onSelect={() => void onCreate?.()}
                className={cn(listboxRowVariants({ size }), "text-accent")}
              >
                {isCreating ? (
                  <Spinner size="sm" />
                ) : (
                  <Plus aria-hidden="true" className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{createLabel(trimmedQuery)}</span>
              </CommandItem>
            )}
          </>
        )}
      </CommandList>

      {createError !== null && (
        <p role="alert" className="border-t border-border px-2 py-1.5 text-body text-danger">
          {createError}
        </p>
      )}
    </Command>
  );
}
