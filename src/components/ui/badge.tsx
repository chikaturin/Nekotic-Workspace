import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  cn(
    "inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-wider",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface text-muted-foreground",
        default: "border-border bg-surface text-muted-foreground",
        info: "border-accent/30 bg-accent-soft text-accent",
        accent: "border-accent/30 bg-accent-soft text-accent",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        danger: "border-danger/30 bg-danger/10 text-danger",
        count: cn(
          "justify-center border-transparent bg-accent text-accent-foreground",
          "min-w-[1.5em] normal-case tracking-normal tabular-nums",
        ),
      },
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
