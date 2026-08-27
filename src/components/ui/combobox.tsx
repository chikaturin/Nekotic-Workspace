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

/**
 * Popover + cmdk — the pairing `ui/popover` has documented as the correct one
 * since it was written, and which nothing implemented until now.
 *
 * Three surfaces arrived at their own version of it independently: the folder
 * access dialog, the workspace invite dialog and the page mover each pair a
 * bare `Input` with a hand-rolled result list, and each one filters, highlights
 * and commits slightly differently.
 *
 * The line between this and `Select` is the length of the list. `Select` walks
 * a short, known set of options with a substring filter and owns its own
 * highlight; a Combobox hands a long list to `cmdk`, which scores matches
 * rather than merely testing for them and keeps the keyboard for itself. The
 * other difference is `onCreate`: a list you search is often a list you are
 * about to add to, which the status picker in the board already knows.
 */

export type ComboboxSize = ListboxSize;

const CREATE_ITEM_VALUE = "__combobox_create__";

function defaultCreateLabel(query: string): string {
  return `Create “${query}”`;
}

export interface ComboboxProps {
  readonly options: readonly ListboxOption[];
  readonly value: string | null;
  /** Symmetric with `value`: clearing reports `null` rather than an empty id. */
  readonly onValueChange: (value: string | null) => void;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyMessage?: ReactNode;
  readonly size?: ComboboxSize;
  readonly variant?: "default" | "ghost";
  readonly isClearable?: boolean;
  readonly isLoading?: boolean;
  readonly isDisabled?: boolean;
  /**
   * Offered as the last row whenever the query matches no existing label.
   * May be async — the row shows a spinner and the popover stays open until it
   * settles, because a dialog that closes before the write lands leaves the
   * user unsure whether anything happened.
   */
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
      // The trigger is a div, so Enter and Space raise no click of their own;
      // every key that opens the list has to be claimed explicitly.
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
      // Swallowing this would leave the row spinning and the option missing,
      // with nothing on screen to say which of the two happened.
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
          // The popup is a search field above a list, not a bare list, and
          // `cmdk`'s own input already carries `role="combobox"` for the pair.
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

/**
 * What `cmdk` scores the search against.
 *
 * The label first, because that is what the user believes they are typing;
 * the description behind it so "the one about billing" still finds a row whose
 * label never says billing.
 */
function keywordsOf(option: ListboxOption): string[] {
  return option.description === undefined
    ? [option.label]
    : [option.label, option.description];
}

/* --------------------------------------------------------------- palette */

export interface CommandDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  /** Read to screen readers as the dialog's name; not drawn. */
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly size?: DialogSize;
  /** Off when the results already arrive filtered — a server-backed search. */
  readonly shouldFilter?: boolean;
  readonly loop?: boolean;
  readonly className?: string;
}

/**
 * A command palette: the Dialog and the Command, wired once.
 *
 * Global search composes these two by hand today, and the composition is
 * fiddlier than it looks — the padding has to come off the dialog, the title
 * and description are required by the dialog and unwanted on screen, and the
 * whole thing has to clip so the command list's own scroll port is the one
 * that scrolls. Getting any of that subtly wrong is invisible until the list
 * is long.
 */
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
  /** Undefined when the caller did not supply an `onCreate`. */
  readonly onCreate?: () => void | Promise<void>;
}

/**
 * Everything inside the popover, as one element.
 *
 * `PopoverContent` renders nothing while it is shut, but JSX children are
 * evaluated before they are handed to it — so writing the list inline builds
 * one React element and one `cn()` merge per option on every render of every
 * closed Combobox on the page. Behind a component boundary the whole subtree
 * is a single unrendered element instead, and the duplicate scan that decides
 * whether "create" is offered stops running too. It is the same extraction
 * `SelectPanel` documents; a picker in a virtualised grid cannot afford
 * otherwise.
 */
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
  /**
   * Creating a duplicate is never what somebody typing an existing name meant,
   * so the row disappears the moment the query names an option that is already
   * there — including one that is disabled, which exists just as much as the
   * rest of them.
   */
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
                // The value is an opaque id, so what the user is actually
                // typing has to be handed to the matcher separately.
                keywords={keywordsOf(option)}
                disabled={option.isDisabled}
                // cmdk lowercases the value it reports back, which would
                // quietly corrupt a case-sensitive id; the option itself is
                // closed over instead of trusting the argument.
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
