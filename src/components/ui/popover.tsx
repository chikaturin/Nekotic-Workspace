"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { PopupAncestry, usePopupLayer } from "@/components/ui/popup-layer";
import { cn } from "@/lib/utils";

/** Popover, có ghi tên vào sổ đăng ký popup — xem `popup-layer.tsx`. */
export function Popover({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Root>) {
  const layer = usePopupLayer({ open, defaultOpen, onOpenChange });

  return (
    <PopoverPrimitive.Root {...props} open={layer.isOpen} onOpenChange={layer.setOpen}>
      <PopupAncestry ancestry={layer.ancestry}>{children}</PopupAncestry>
    </PopoverPrimitive.Root>
  );
}

export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-dropdown rounded-lg border border-border bg-elevated p-2 shadow-float outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
