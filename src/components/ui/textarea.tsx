"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ChangeEvent, type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Everything a multi-line field has to undo from the single-line shell it
 * shares with Input: a fixed control height becomes a floor, and the
 * horizontal-only padding gains a vertical half.
 *
 * `resize-none` is the default because every hand-rolled textarea in this app
 * already set it — a drag handle in the corner of a field inside a dialog
 * lets the user push the submit button off the bottom of the sheet. Callers
 * that want it back pass `resize-y`.
 */
const textareaShapeVariants = cva("block h-auto resize-none", {
  variants: {
    size: {
      xs: "min-h-[var(--control-xs)] py-1",
      sm: "min-h-[var(--control-sm)] py-1.5",
      md: "min-h-[var(--control-md)] py-1.5",
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * The ceiling auto-resize grows to, expressed as a class so a caller can
 * raise or lower it with `max-h-*` — `syncHeight` reads back whatever the
 * cascade settled on rather than hard-coding a number in two places.
 */
const AUTO_RESIZE_MAX_HEIGHT = "max-h-48";

/** Room under the last line for the character counter to sit in. */
const COUNTER_CLEARANCE = "pb-5";

export type TextareaProps = Omit<ComponentProps<"textarea">, "size"> &
  VariantProps<typeof inputVariants> & {
    /**
     * Grow with the content instead of scrolling inside a fixed `rows` box,
     * up to `max-h-48` unless the caller overrides it.
     */
    readonly autoResize?: boolean;
    /** Show a `used/limit` counter in the bottom-right. Needs `maxLength`. */
    readonly showCount?: boolean;
  };

/** A textarea's value can arrive as a string, a number, or (rarely) a list. */
function textLength(value: ComponentProps<"textarea">["value"]): number {
  if (value === undefined || value === null) return 0;
  if (Array.isArray(value)) return value.join("").length;
  return String(value).length;
}

export function Textarea({
  className,
  variant,
  size,
  autoResize = false,
  showCount = false,
  maxLength,
  value,
  defaultValue,
  onChange,
  ref: forwardedRef,
  ...props
}: TextareaProps) {
  const nodeRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Uncontrolled fields have no value to count, so the length is tracked from
   * the change event. Controlled ones derive it from the prop instead of
   * mirroring it into state — a `useEffect` that copies props into state is
   * both a render behind and the thing the React Compiler rules forbid.
   */
  const [uncontrolledLength, setUncontrolledLength] = useState(() => textLength(defaultValue));
  const length = value === undefined ? uncontrolledLength : textLength(value);

  const syncHeight = useCallback(
    (node: HTMLTextAreaElement) => {
      if (!autoResize) {
        // Hand the box back to `rows`; leaving the last measured height
        // behind would freeze it at whatever the content happened to be.
        node.style.height = "";
        node.style.overflowY = "";
        return;
      }

      // Collapse before measuring. `scrollHeight` cannot report less than the
      // current height, so without this the field grows as you type and then
      // refuses to shrink when you delete.
      node.style.height = "auto";

      const styles = getComputedStyle(node);
      // `scrollHeight` covers padding but not the border, while box-sizing is
      // border-box — assigning it verbatim clips the last line by exactly the
      // border width and the caret disappears under the bottom edge.
      const borderY =
        Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
      const contentHeight = node.scrollHeight + borderY;

      // `max-height` is "none" when unset, which parses to NaN.
      const maxHeight = Number.parseFloat(styles.maxHeight);
      const nextHeight = Number.isFinite(maxHeight)
        ? Math.min(contentHeight, maxHeight)
        : contentHeight;

      node.style.height = `${nextHeight}px`;
      // Only scroll once the ceiling is reached; below it an always-on
      // scrollbar steals width from a box that is exactly the right size.
      node.style.overflowY = contentHeight > nextHeight ? "auto" : "hidden";
    },
    [autoResize],
  );

  /**
   * Sizing happens on attach rather than in a layout effect: a callback ref
   * runs during commit, before paint, so a field mounted with content never
   * flashes at one row and then jumps. `useLayoutEffect` would also warn on
   * every server render of a page that contains one.
   */
  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null): void => {
      nodeRef.current = node;
      if (node) syncHeight(node);

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }
      if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef, syncHeight],
  );

  // Catches the value changing from outside — a reset button, a loaded draft —
  // which produces no change event of its own.
  useEffect(() => {
    const node = nodeRef.current;
    if (node) syncHeight(node);
  }, [syncHeight, value]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (value === undefined) setUncontrolledLength(event.target.value.length);
    // Measured from the event target, which the browser has already updated,
    // so the box grows in the same frame as the keystroke.
    syncHeight(event.target);
    onChange?.(event);
  }

  const isAtLimit = maxLength !== undefined && length >= maxLength;
  const field = (
    <textarea
      ref={attachRef}
      data-slot="textarea"
      value={value}
      defaultValue={defaultValue}
      maxLength={maxLength}
      onChange={handleChange}
      className={cn(
        inputVariants({ variant, size }),
        textareaShapeVariants({ size }),
        autoResize && AUTO_RESIZE_MAX_HEIGHT,
        showCount && COUNTER_CLEARANCE,
        className,
      )}
      {...props}
    />
  );

  // The wrapper only exists to position the counter, so it is not rendered
  // when there is no counter — an unconditional extra element would quietly
  // change how the field behaves inside a flex or grid parent.
  if (!showCount) return field;

  return (
    <div className="relative w-full">
      {field}
      <span
        className={cn(
          "pointer-events-none absolute right-2 bottom-1.5 tabular-nums text-micro",
          isAtLimit ? "text-danger" : "text-faint-foreground",
        )}
      >
        {maxLength === undefined ? length : `${length}/${maxLength}`}
      </span>
    </div>
  );
}

export { textareaShapeVariants };
