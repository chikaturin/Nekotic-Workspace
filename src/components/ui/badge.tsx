import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Two components share this file because they share a silhouette and nothing
 * else.
 *
 * A `Badge` is a *label*: a word about the thing next to it, set in small caps
 * so it reads as chrome rather than as content. A `CountBadge` is a *number*:
 * it has no case to speak of, letterspacing actively hurts it, and it wants to
 * be a filled dot rather than an outlined tag. They were one component with a
 * `count` variant that quietly undid three rules from the base string, which
 * is the shape a component takes right before it should be two.
 *
 * `variant="count"` still routes here, so nothing that already uses it has to
 * move; new code should reach for `CountBadge` and skip the indirection.
 */
const badgeVariants = cva(
  cn(
    "inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-wider",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    /**
     * One tone ramp, six steps: `neutral` for chrome, `info` for anything the
     * accent colour speaks for, and the three status colours. Every step is
     * built the same way — a tenth of the colour behind it, a third of it on
     * the border, the colour itself for the text — so a row of mixed badges
     * reads as one family and a new tone is one line, not a design decision.
     *
     * `default` and `accent` are the names this component shipped with and are
     * kept as exact aliases of `neutral` and `info`. Aliasing rather than
     * renaming means the ~35 existing call sites never had to be touched, and
     * an alias that is literally the same string cannot drift from its target.
     */
    variants: {
      variant: {
        neutral: "border-border bg-surface text-muted-foreground",
        default: "border-border bg-surface text-muted-foreground",
        info: "border-accent/30 bg-accent-soft text-accent",
        accent: "border-accent/30 bg-accent-soft text-accent",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        danger: "border-danger/30 bg-danger/10 text-danger",
        // Filled, uncased, unspaced and at least as wide as it is tall, so a
        // single digit is a disc instead of a squashed ellipse. `tabular-nums`
        // keeps a live counter from jittering as it ticks 8 -> 9 -> 10.
        count: cn(
          "justify-center border-transparent bg-accent text-accent-foreground",
          "min-w-[1.5em] normal-case tracking-normal tabular-nums",
        ),
      },
      /**
       * Type step and padding move together: an 11px badge needs the extra
       * horizontal room to keep the pill's curve off the glyphs, and picking
       * them separately is how two badges in the same row end up different
       * heights. The icon rule rides along for the same reason — a lucide icon
       * defaults to 24px and would tear the pill open without it.
       */
      size: {
        sm: "px-1.5 py-px text-micro [&_svg]:size-2.5",
        md: "px-2 py-0.5 text-body [&_svg]:size-3",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>["size"]>;

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export type CountBadgeProps = ComponentProps<"span"> & {
  readonly size?: BadgeSize;
};

/**
 * The tally next to a filter, a tab or a nav row. Takes the count as its
 * children so the swap from `<Badge variant="count">` is the tag name alone.
 */
export function CountBadge({ className, size, ...props }: CountBadgeProps) {
  return (
    <span
      data-slot="count-badge"
      className={cn(badgeVariants({ variant: "count", size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
