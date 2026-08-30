"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import {
  DialogBody,
  DialogCloseButton,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPortal;
export const SheetOverlay = DialogOverlay;

export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
export const SheetHeader = DialogHeader;
export const SheetBody = DialogBody;
export const SheetFooter = DialogFooter;

const sheetContentVariants = cva(
  [
    "fixed z-modal flex flex-col bg-elevated shadow-float outline-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
  ].join(" "),
  {
    variants: {
      side: {
        right: [
          "inset-y-0 right-0 border-l border-border",
          "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        ].join(" "),
        left: [
          "inset-y-0 left-0 border-r border-border",
          "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
        ].join(" "),
        bottom: [
          "inset-x-0 bottom-0 rounded-t-xl border-t border-border",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        ].join(" "),
      },
      size: { sm: "", md: "", lg: "", xl: "" },
    },
    compoundVariants: [
      { side: ["right", "left"], size: "sm", class: "w-full max-w-[22rem]" },
      { side: ["right", "left"], size: "md", class: "w-full max-w-[36rem]" },
      { side: ["right", "left"], size: "lg", class: "w-full max-w-[48rem]" },
      { side: ["right", "left"], size: "xl", class: "w-full max-w-[64rem]" },

      { side: "bottom", size: "sm", class: "h-[38dvh]" },
      { side: "bottom", size: "md", class: "h-[58dvh]" },
      { side: "bottom", size: "lg", class: "h-[76dvh]" },
      { side: "bottom", size: "xl", class: "h-[92dvh]" },
    ],
    defaultVariants: { side: "right", size: "md" },
  },
);

export type SheetSide = NonNullable<VariantProps<typeof sheetContentVariants>["side"]>;
export type SheetSize = NonNullable<VariantProps<typeof sheetContentVariants>["size"]>;

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  readonly side?: SheetSide;
  readonly size?: SheetSize;
  readonly hideClose?: boolean;
}

export function SheetContent({
  className,
  children,
  side,
  size,
  hideClose = false,
  ...props
}: SheetContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(sheetContentVariants({ side, size }), className)}
        {...props}
      >
        {children}
        {!hideClose && <DialogCloseButton />}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export const Drawer = Sheet;
export const DrawerTrigger = SheetTrigger;
export const DrawerClose = SheetClose;
export const DrawerPortal = SheetPortal;
export const DrawerOverlay = SheetOverlay;
export const DrawerContent = SheetContent;
export const DrawerTitle = SheetTitle;
export const DrawerDescription = SheetDescription;
export const DrawerHeader = SheetHeader;
export const DrawerBody = SheetBody;
export const DrawerFooter = SheetFooter;

export { sheetContentVariants };
