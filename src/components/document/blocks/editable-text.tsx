"use client";

import type { KeyboardEvent } from "react";
import { useContentEditable } from "@/hooks/use-content-editable";
import { cn } from "@/lib/utils";
import type { FocusRequest } from "@/types";

interface EditableTextProps {
  readonly blockId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly isEditable: boolean;
  readonly focusRequest: FocusRequest | null;
  readonly placeholder: string;
  readonly className?: string;
  readonly ariaLabel: string;
  /** Present while the slash menu is open, wiring up the combobox pattern. */
  readonly menu?: { readonly listboxId: string; readonly activeOptionId: string | null };
}

/**
 * One editable line. The caret contract lives in `useContentEditable`; this
 * component only owns presentation and forwards key events upwards.
 */
export function EditableText({
  blockId,
  value,
  onChange,
  onKeyDown,
  isEditable,
  focusRequest,
  placeholder,
  className,
  ariaLabel,
  menu,
}: EditableTextProps) {
  const { editableProps } = useContentEditable({
    blockId,
    value,
    onChange,
    isEditable,
    focusRequest,
  });

  return (
    <div
      {...editableProps}
      onKeyDown={onKeyDown}
      data-placeholder={placeholder}
      aria-label={ariaLabel}
      aria-readonly={!isEditable}
      role={menu ? "combobox" : editableProps.role}
      aria-expanded={menu ? true : undefined}
      aria-autocomplete={menu ? "list" : undefined}
      aria-controls={menu?.listboxId}
      aria-activedescendant={menu?.activeOptionId ?? undefined}
      className={cn(
        "w-full whitespace-pre-wrap break-words outline-none",
        "empty:before:pointer-events-none empty:before:text-faint-foreground empty:before:content-[attr(data-placeholder)]",
        !isEditable && "cursor-default select-text",
        className,
      )}
    />
  );
}
