"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The five diameters the app actually draws, named.
 *
 * Every one of these already existed — as `className="size-4"` on a timeline
 * row, `size-5` in a cell, `size-6` in a member list, `size-8` in a menu —
 * layered on top of a hard-coded `size-7` in the Root that each of them had to
 * out-specify. Naming the ladder means a call site asks for the size that
 * matches its context instead of restating a number, and `lg` stays the
 * default so every existing `className` override keeps landing exactly where
 * it did before.
 */
const avatarVariants = cva("relative flex shrink-0 overflow-hidden rounded-full", {
  variants: {
    size: {
      xs: "size-4",
      sm: "size-5",
      md: "size-6",
      lg: "size-7",
      xl: "size-8",
    },
  },
  defaultVariants: { size: "lg" },
});

export type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>;

/**
 * Initials are type inside a circle, so they have to scale with the circle.
 * Frozen at 10px they were nearly touching the edges of a 16px avatar and
 * floating in the middle of a 32px one.
 *
 * The bottom three steps stay at the 10px floor of the type ramp — there is no
 * smaller token, and inventing one for two letters is not worth a sixth step —
 * but they trade the wide tracking for tight, which is what actually buys back
 * the room in a 16px disc.
 */
const avatarFallbackVariants = cva(
  "flex size-full items-center justify-center bg-elevated font-semibold text-muted-foreground",
  {
    variants: {
      size: {
        xs: "text-micro tracking-tight",
        sm: "text-micro tracking-tight",
        md: "text-micro tracking-wide",
        lg: "text-body tracking-wide",
        xl: "text-ui tracking-wide",
      },
    },
    defaultVariants: { size: "lg" },
  },
);

/**
 * The fallback is a sibling of the Root in the JSX but a child of it visually,
 * and it is the Root that knows how big the circle is.
 *
 * Context rather than a descendant selector on the Root (`[&_[data-slot=...]]`)
 * because the two would then live on different elements, and `tailwind-merge`
 * can only resolve a conflict between classes it sees in one string — a
 * consumer passing `className="text-lead"` to the fallback would lose to the
 * Root's rule on specificity, silently. Through context every class the
 * fallback wears goes through a single `cn`, so an override wins the way an
 * override is supposed to.
 */
const AvatarSizeContext = createContext<AvatarSize>("lg");

export type AvatarProps = ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants>;

export function Avatar({ className, size, ...props }: AvatarProps) {
  return (
    <AvatarSizeContext.Provider value={size ?? "lg"}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        data-size={size ?? "lg"}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      />
    </AvatarSizeContext.Provider>
  );
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export type AvatarFallbackProps = ComponentProps<typeof AvatarPrimitive.Fallback> &
  VariantProps<typeof avatarFallbackVariants>;

export function AvatarFallback({ className, size, ...props }: AvatarFallbackProps) {
  const inheritedSize = useContext(AvatarSizeContext);

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants({ size: size ?? inheritedSize }), className)}
      {...props}
    />
  );
}

export { avatarVariants, avatarFallbackVariants };
