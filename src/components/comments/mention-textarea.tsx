"use client";

import { useRef, type KeyboardEvent } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useMentionPicker } from "@/hooks/use-mention-picker";
import { isComposingKey } from "@/lib/dom/ime";
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
  readonly onSubmit?: () => void;
  readonly onEscape?: () => void;
}

export const ESCAPE_OWNER_ATTRIBUTE = "data-escape-owner";

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

  const wasConsumedRef = useRef(false);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Bộ gõ tiếng Việt đang ghép chữ: Enter lúc này là để CHỐT chữ đang gõ dở.
    // Không chặn ở đây thì một cú bấm gửi luôn bình luận còn viết dở.
    if (isComposingKey(event.nativeEvent)) return;

    // Danh sách nhắc tên đang mở thì Enter là để CHỌN người, không phải để gửi.
    wasConsumedRef.current = picker.handleKeyDown(event);
    if (wasConsumedRef.current) return;

    if (event.key === "Enter" && onSubmit && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onSubmit();
      return;
    }

    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
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
