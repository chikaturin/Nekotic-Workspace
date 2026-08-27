"use client";

import { useRef, type KeyboardEvent } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useMentionPicker } from "@/hooks/use-mention-picker";
import { cn } from "@/lib/utils";
import type { DirectoryUser } from "@/types";

interface MentionTextareaProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly people: readonly DirectoryUser[];
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly rows?: number;
  readonly autoFocus?: boolean;
  /** ⌘/Ctrl + Enter. Plain Enter stays a newline unless the picker is open. */
  readonly onSubmit?: () => void;
  readonly onEscape?: () => void;
}

/**
 * Marks a field that handles Escape itself.
 *
 * A dialog's Escape listener runs in the capture phase on `document`, so it
 * fires before anything inside the dialog can stop it. Surfaces that host this
 * textarea read the attribute in `onEscapeKeyDown` and stand down when the
 * press belongs to a composer.
 */
export const ESCAPE_OWNER_ATTRIBUTE = "data-escape-owner";

/**
 * Textarea with the `@` picker attached (CO-MEN-27).
 *
 * The picker owns ↑ ↓ Enter Tab Esc while it is open and reports back whether
 * it consumed the key, so the composer's own shortcuts never fire underneath
 * a selection.
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  ariaLabel,
  rows = 2,
  autoFocus = false,
  onSubmit,
  onEscape,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const picker = useMentionPicker({ people, value, onChange, textareaRef });

  /**
   * Whether the picker consumed the last key-down.
   *
   * `preventDefault` stops the caret from moving but not the key-up from
   * firing, so without this the arrow keys would re-sync the picker and snap
   * the highlight back to the first candidate, and Escape would immediately
   * re-open the picker it had just closed.
   */
  const wasConsumedRef = useRef(false);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    wasConsumedRef.current = picker.handleKeyDown(event);
    if (wasConsumedRef.current) return;

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit?.();
      return;
    }

    if (event.key === "Escape" && onEscape) {
      // Escape belongs to the composer that owns one: cancelling a reply must
      // not also close the drawer the reply sits in.
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        // Escape either closes the picker or cancels this composer; either way
        // it is not the surrounding dialog's to act on.
        {...{ [ESCAPE_OWNER_ATTRIBUTE]: picker.isOpen || onEscape ? "true" : undefined }}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          onChange(event.target.value);
          picker.sync(event.target.value, event.target.selectionStart);
        }}
        onKeyUp={(event) => {
          if (wasConsumedRef.current) {
            wasConsumedRef.current = false;
            return;
          }
          picker.sync(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onClick={(event) =>
          picker.sync(event.currentTarget.value, event.currentTarget.selectionStart)
        }
        onBlur={() => picker.close()}
        onKeyDown={handleKeyDown}
        className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none placeholder:text-faint-foreground"
      />

      {picker.isOpen && (
        <ul
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute bottom-full left-0 z-dropdown mb-1 w-64 overflow-hidden rounded-lg border border-border bg-elevated p-1 shadow-float"
        >
          {picker.candidates.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === picker.activeIndex}
                // The textarea blurs before click lands, so commit on mousedown.
                onMouseDown={(event) => {
                  event.preventDefault();
                  picker.choose(person);
                }}
                onMouseEnter={() => picker.setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                  index === picker.activeIndex ? "bg-hover" : "hover:bg-hover",
                )}
              >
                <UserAvatar user={person} className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-foreground">
                    {person.name}
                  </span>
                  <span className="block truncate text-[10px] text-faint-foreground">
                    {person.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
