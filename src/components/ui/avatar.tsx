"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

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
