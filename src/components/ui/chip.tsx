"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { SELECT_COLOR_CLASSES, SELECT_SOLID_CLASSES } from "@/lib/board-schema";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

const chipVariants = cva(
  cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border font-medium",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        filled: "border-border bg-surface text-muted-foreground",
        placeholder: "border-dashed border-border bg-transparent text-faint-foreground",
      },
      size: {
        xs: "px-1.5 text-micro [&_svg]:size-2.5",
        sm: "px-1.5 py-px text-body [&_svg]:size-3",
        md: "px-2 py-0.5 text-body [&_svg]:size-3",
      },
    },
    defaultVariants: { variant: "filled", size: "md" },
  },
);

export type ChipSize = NonNullable<VariantProps<typeof chipVariants>["size"]>;
export type ChipVariant = NonNullable<VariantProps<typeof chipVariants>["variant"]>;

export type ChipProps = Omit<ComponentProps<"span">, "color"> &
  VariantProps<typeof chipVariants> & {
    readonly color?: SelectColor;
    readonly leading?: ReactNode;
    readonly onRemove?: () => void;
    readonly removeLabel?: string;
  };

export function Chip({
  className,
  variant,
  size,
  color,
  leading,
  onRemove,
  removeLabel,
  children,
  ...props
}: ChipProps) {
  const palette = variant === "placeholder" || !color ? undefined : SELECT_COLOR_CLASSES[color];
  const accessibleRemoveLabel =
    removeLabel ?? (typeof children === "string" ? `Remove ${children}` : "Remove");

  return (
    <span
      data-slot="chip"
      className={cn(chipVariants({ variant, size }), palette, className)}
      {...props}
    >
      {leading}
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={accessibleRemoveLabel}
          className={cn(
            "-my-0.5 -mr-0.5 inline-flex shrink-0 rounded-full p-0.5 text-faint-foreground",
            "outline-none transition-colors hover:text-foreground",
            "focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X />
        </button>
      ) : null}
    </span>
  );
}

const chipDotVariants = cva("inline-block shrink-0 rounded-full border", {
  variants: {
    variant: {
      tint: "",
      solid: "border-transparent",
    },
  },
  defaultVariants: { variant: "tint" },
});

export type ChipDotProps = Omit<ComponentProps<"span">, "color"> &
  VariantProps<typeof chipDotVariants> & {
    readonly color: SelectColor;
  };

export function ChipDot({ className, variant, color, ...props }: ChipDotProps) {
  const palette = variant === "solid" ? SELECT_SOLID_CLASSES[color] : SELECT_COLOR_CLASSES[color];

  return (
    <span
      aria-hidden
      data-slot="chip-dot"
      className={cn("size-2.5", chipDotVariants({ variant }), palette, className)}
      {...props}
    />
  );
}

export { chipVariants, chipDotVariants };
