"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { SELECT_COLOR_CLASSES, SELECT_SOLID_CLASSES } from "@/lib/board-schema";
import { cn } from "@/lib/utils";
import type { SelectColor } from "@/types";

/**
 * The rounded, colour-tinted label the app draws wherever a select option,
 * a group key or a status shows up.
 *
 * There were six of these. `SelectChip` in the board's select cell was already
 * the shared one in everything but location — no board coupling, imported by
 * devtools — and five other files re-derived it inline from
 * `SELECT_COLOR_CLASSES` with four different paddings and three different type
 * steps, so the same status read as a different object in the Kanban header,
 * the group row and the My Work list. The disagreement was never a decision;
 * it was six people reaching for `px-2` or `px-1.5` on six different days.
 *
 * The colour is deliberately not a CVA variant. `SELECT_COLOR_CLASSES` is the
 * one place the eight option colours are defined and the Gantt bars and the
 * colour picker read the same map, so duplicating it as eight CVA branches
 * would fork it. The palette is appended after the variant classes instead,
 * where `tailwind-merge` lets it beat the neutral fallback.
 */
const chipVariants = cva(
  cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border font-medium",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        /** A real value. Wears the option colour when it has one. */
        filled: "border-border bg-surface text-muted-foreground",
        /**
         * The absence of a value — "No value" in the transition editor. Dashed
         * and unfilled because an empty slot that looks like a filled chip is
         * indistinguishable from an option someone happened to name "None".
         */
        placeholder: "border-dashed border-border bg-transparent text-faint-foreground",
      },
      /**
       * Padding, type step and icon size move as one, because a chip is a pill
       * around a line of text: change the type without the padding and the
       * curve starts clipping the glyphs. `md` is the shape the select cell and
       * the two board headers already drew, so it is the default.
       */
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
    /**
     * One of the eight board option colours. Omitted, the chip stays neutral —
     * which is what a status with no colour assigned should look like, rather
     * than borrowing grey and pretending it was chosen.
     */
    readonly color?: SelectColor;
    /** Rendered before the label: a `ChipDot`, or any lucide icon. */
    readonly leading?: ReactNode;
    /** Shows the remove affordance. Omitted, the chip is a plain label. */
    readonly onRemove?: () => void;
    /**
     * Accessible name for the remove button. Defaults to `Remove <label>` when
     * the chip's content is a plain string, because that is the useful name and
     * every current call site passes exactly that.
     */
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
  // A placeholder has no value, so it has no colour to wear; letting one
  // through would tint the dashed outline and undo the whole distinction.
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
          // The negative margins buy the 12px glyph a padded hit target without
          // making the chip taller: the padding it adds is exactly the margin it
          // gives back, so a row of chips keeps its height either way.
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
      /** The tinted disc used in menus, where it sits next to plain text. */
      tint: "",
      /**
       * Full-strength, for a dot inside a chip that is already wearing the same
       * colour at 15% — a tint on a tint is invisible at 10px.
       */
      solid: "border-transparent",
    },
  },
  defaultVariants: { variant: "tint" },
});

export type ChipDotProps = Omit<ComponentProps<"span">, "color"> &
  VariantProps<typeof chipDotVariants> & {
    readonly color: SelectColor;
  };

/**
 * The colour on its own, no label. Menus use it to mark which option a row
 * sets; a `Chip` takes it as `leading` when the label alone is ambiguous.
 */
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
