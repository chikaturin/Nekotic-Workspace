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

export type ListboxSize = "xs" | "sm" | "md";

export interface ListboxOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly color?: SelectColor;
  readonly avatarUrl?: string;
  readonly isDisabled?: boolean;
  readonly disabledReason?: string;
}

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

export function listboxOptionId(listboxId: string, value: string): string {
  return `${listboxId}-option-${value.replace(ID_UNSAFE_CHARS, "_")}`;
}

export function Listbox({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="listbox"
      role="listbox"
      className={cn(
        "max-h-64 overflow-y-auto overscroll-contain p-1",
        className,
      )}
      {...props}
    />
  );
}

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
      <Spinner size="sm" />
      {label}
    </div>
  );
}

const listboxRowVariants = cva(
  [
    "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md text-left outline-none transition-colors",
    "text-foreground",
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

const SELECT_COLOR_DOT = SELECT_SOLID_CLASSES;

export interface ListboxOptionVisualProps {
  readonly option: ListboxOption;
  readonly size?: ListboxSize;
  readonly className?: string;
}

export function ListboxOptionVisual({
  option,
  size = "sm",
  className,
}: ListboxOptionVisualProps) {
  if (option.avatarUrl !== undefined) {
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
  readonly trailing?: ReactNode;
}

export function ListboxOptionContent({
  option,
  isSelected = false,
  size = "sm",
  trailing,
}: ListboxOptionContentProps) {
  const isDisabled = option.isDisabled === true;
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
  readonly id?: string;
  readonly isSelected?: boolean;
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

export interface ListboxTriggerProps
  extends Omit<ComponentProps<"div">, "role" | "tabIndex" | "children"> {
  readonly isOpen: boolean;
  readonly isDisabled?: boolean;
  readonly isLoading?: boolean;
  readonly size?: ListboxSize;
  readonly variant?: "default" | "ghost";
  readonly popupId?: string;
  readonly popupRole?: "listbox" | "dialog";
  readonly activeDescendantId?: string;
  readonly trailing?: ReactNode;
  readonly children?: ReactNode;
}

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
