"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const switchVariants = cva("relative inline-flex shrink-0 items-center rounded-full", {
  variants: {
    size: {
      sm: "h-3.5 w-6.5",
      md: "h-4.5 w-8",
    },
  },
  defaultVariants: { size: "md" },
});

const switchThumbVariants = cva(
  "pointer-events-none relative ml-0.5 rounded-full shadow-raise transition-transform duration-150",
  {
    variants: {
      size: {
        sm: "size-2.5",
        md: "size-3.5",
      },
      isOn: {
        true: "bg-accent-foreground",
        false: "bg-surface",
      },
    },
    compoundVariants: [
      { size: "sm", isOn: true, class: "translate-x-3" },
      { size: "md", isOn: true, class: "translate-x-3.5" },
    ],
    defaultVariants: { size: "md", isOn: false },
  },
);

export interface SwitchProps
  extends Omit<ComponentProps<"input">, "type" | "role" | "checked" | "onChange" | "size">,
    VariantProps<typeof switchVariants> {
  readonly checked: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked,
  onCheckedChange,
  size,
  disabled,
  className,
  ...props
}: SwitchProps) {
  return (
    <span
      data-slot="switch"
      className={cn(
        switchVariants({ size }),
        disabled && "opacity-[var(--disabled-opacity)]",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          "absolute inset-0 size-full cursor-pointer appearance-none rounded-full outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
          checked
            ? "bg-accent enabled:hover:bg-accent-hover"
            : "bg-border-strong enabled:hover:bg-faint-foreground",
        )}
        {...props}
      />

      <span className={switchThumbVariants({ size, isOn: checked })} />
    </span>
  );
}
