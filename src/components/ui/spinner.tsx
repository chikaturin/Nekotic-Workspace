import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* The steps are the icon scale, not a scale of their own. A spinner nearly
 * always stands in for an icon that is coming back — a button's leading glyph,
 * a row's status dot — and one that is a size the icon ladder does not have
 * makes the row it lives in jump by a pixel or two when the work finishes. */
const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      xs: "size-2.5", // --icon-xs, 10px
      sm: "size-3", //   --icon-sm, 12px
      md: "size-3.5", // --icon-md, 14px — the workspace default
      lg: "size-4", //   --icon-lg, 16px
    },
  },
  defaultVariants: { size: "md" },
});

export type SpinnerProps = ComponentProps<"span"> &
  VariantProps<typeof spinnerVariants> & {
    /**
     * Announced when the spinner appears. A spinning glyph is invisible to a
     * screen reader, so a spinner that is the only sign of work in progress —
     * one that replaces a list, or sits alone in a toolbar — needs this.
     * Leave it off when something nearby already says it: a `Button` with
     * `isLoading` keeps its own visible label, and a region with `aria-busy`
     * announces itself, so a second announcement is just noise.
     */
    readonly label?: string;
  };

/**
 * The one spinner. Size comes from the `size` prop rather than from
 * `className`, which lands on the wrapper and so styles placement and colour —
 * the glyph strokes in `currentColor`, so `className="text-accent"` tints it.
 */
export function Spinner({ className, size, label, ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      /* The semantics follow the label. A spinner sitting beside text that
         already says "Loading options…" is decoration — announcing it a
         second time as its own live region is noise, not access. */
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle aria-hidden="true" className={spinnerVariants({ size })} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export { spinnerVariants };
