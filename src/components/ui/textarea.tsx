"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ChangeEvent, type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const AUTO_RESIZE_MAX_HEIGHT = "max-h-48";

const COUNTER_CLEARANCE = "pb-5";

export type TextareaProps = Omit<ComponentProps<"textarea">, "size"> &
  VariantProps<typeof inputVariants> & {
    readonly autoResize?: boolean;
    readonly showCount?: boolean;
  };

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

  const [uncontrolledLength, setUncontrolledLength] = useState(() => textLength(defaultValue));
  const length = value === undefined ? uncontrolledLength : textLength(value);

  const syncHeight = useCallback(
    (node: HTMLTextAreaElement) => {
      if (!autoResize) {
        node.style.height = "";
        node.style.overflowY = "";
        return;
      }

      node.style.height = "auto";

      const styles = getComputedStyle(node);
      const borderY =
        Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth);
      const contentHeight = node.scrollHeight + borderY;

      const maxHeight = Number.parseFloat(styles.maxHeight);
      const nextHeight = Number.isFinite(maxHeight)
        ? Math.min(contentHeight, maxHeight)
        : contentHeight;

      node.style.height = `${nextHeight}px`;
      node.style.overflowY = contentHeight > nextHeight ? "auto" : "hidden";
    },
    [autoResize],
  );

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

  useEffect(() => {
    const node = nodeRef.current;
    if (node) syncHeight(node);
  }, [syncHeight, value]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (value === undefined) setUncontrolledLength(event.target.value.length);
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
