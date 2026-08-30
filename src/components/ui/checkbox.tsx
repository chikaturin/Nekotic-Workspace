"use client";

import { Check, Minus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "checked"> {
  readonly checked: boolean;
  readonly isIndeterminate?: boolean;
}

export function Checkbox({
  checked,
  isIndeterminate = false,
  className,
  ...props
}: CheckboxProps) {
  const isMarked = checked || isIndeterminate;

  return (
    <span className={cn("relative inline-flex size-4 shrink-0 items-center justify-center", className)}>
      <input
        type="checkbox"
        checked={checked}
        ref={(node) => {
          if (node) node.indeterminate = isIndeterminate;
        }}
        className={cn(
          "size-4 cursor-pointer appearance-none rounded border transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]",
          isMarked ? "border-accent bg-accent" : "border-border-strong bg-surface hover:border-accent",
        )}
        {...props}
      />

      {isMarked && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-accent-foreground">
          {isIndeterminate ? (
            <Minus className="size-3" strokeWidth={3} />
          ) : (
            <Check className="size-3" strokeWidth={3} />
          )}
        </span>
      )}
    </span>
  );
}
