import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The shell every text-entry control wears: Input, Textarea and Select all
 * call this so a field cannot drift into being 30px tall with a 1.5px focus
 * ring just because it was written on a different afternoon.
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 * 1. `aria-invalid` is styled. Callers were already setting it — the create
 *    workspace dialog has done so since it was written — and nothing in the
 *    old input responded, so a field that failed validation looked exactly
 *    like one that passed and the error text below it was the only tell.
 *
 * 2. The invalid rules are doubled up under `focus-visible` and `hover`.
 *    `[aria-invalid="true"]` and `:focus-visible` carry identical
 *    specificity, so which colour wins would otherwise come down to the order
 *    Tailwind happens to emit them in — the field would go red until you
 *    touched it and then quietly turn blue, which reads as "fixed". Compound
 *    variants raise specificity by one and settle it.
 */
const inputVariants = cva(
  [
    "flex w-full min-w-0 rounded-md text-foreground outline-none transition-colors",
    "placeholder:text-faint-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]",
    "aria-invalid:border-danger aria-invalid:ring-danger/30",
    "aria-invalid:hover:border-danger",
    "aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/30",
  ],
  {
    variants: {
      variant: {
        default: "border border-border bg-surface hover:border-border-strong focus-visible:border-accent",
        /**
         * Transparent until touched, for a control that sits inside a surface
         * which already draws the box — a grid cell editor, the caption under
         * an image block. The border is kept at `transparent` rather than
         * removed so gaining one on hover does not shift the text by a pixel.
         */
        ghost: "border border-transparent bg-transparent hover:border-border focus-visible:border-accent",
      },
      size: {
        xs: "h-[var(--control-xs)] px-[var(--control-pad-xs)] text-body",
        sm: "h-[var(--control-sm)] px-[var(--control-pad-sm)] text-ui",
        md: "h-[var(--control-md)] px-[var(--control-pad-md)] text-ui",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

/**
 * `size` is omitted from the DOM props on purpose: `<input size>` is the
 * legacy character-count attribute, and intersecting it with the variant
 * union would collapse the prop to `never`. Nothing in the app uses it.
 */
export type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

export function Input({ className, type = "text", variant, size, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { inputVariants };
