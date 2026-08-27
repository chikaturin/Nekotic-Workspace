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

/**
 * A panel that slides in from an edge, built on the dialog primitive so it
 * inherits the focus trap, the scroll lock and Escape-to-close.
 *
 * It used to reach for the primitive directly and keep its own overlay and
 * close button, which meant two copies of the same markup — and the copies
 * had already drifted: the overlay stacked an opacity modifier on a token
 * that is translucent to begin with, and the panel sat on `bg-background`
 * where every other floating surface sits on `bg-elevated`. Composing the
 * dialog's own pieces is what stops that happening again.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPortal;
export const SheetOverlay = DialogOverlay;

// Titles, descriptions and the three structural bands are the same thing on
// both surfaces, down to the class strings, so the sheet re-exports them
// rather than owning a second set that can disagree with the first.
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
export const SheetHeader = DialogHeader;
export const SheetBody = DialogBody;
export const SheetFooter = DialogFooter;

/* --------------------------------------------------------------- geometry
 * `side` decides which edge the panel is anchored to and therefore which way
 * it slides; `size` decides how far it reaches into the viewport. The two
 * interact, because reaching further means width on a side panel and height
 * on a bottom sheet — hence the compound variants rather than one flat scale
 * that would have to mean both things at once.
 */
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
          // Rounded on the two corners that are actually visible; the bottom
          // two are off-screen, and rounding them costs a seam on the edge.
          "inset-x-0 bottom-0 rounded-t-xl border-t border-border",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        ].join(" "),
      },
      size: { sm: "", md: "", lg: "", xl: "" },
    },
    compoundVariants: [
      // Side panels are capped by max-width for the same reason the dialog is:
      // tailwind-merge resolves `max-w-*` against `max-w-*`, so a call site
      // that still passes its own width keeps winning.
      { side: ["right", "left"], size: "sm", class: "w-full max-w-[22rem]" },
      { side: ["right", "left"], size: "md", class: "w-full max-w-[36rem]" },
      { side: ["right", "left"], size: "lg", class: "w-full max-w-[48rem]" },
      { side: ["right", "left"], size: "xl", class: "w-full max-w-[64rem]" },

      // Bottom sheets are measured in dynamic viewport height so a mobile URL
      // bar sliding away does not leave a strip of page under the panel.
      { side: "bottom", size: "sm", class: "h-[38dvh]" },
      { side: "bottom", size: "md", class: "h-[58dvh]" },
      { side: "bottom", size: "lg", class: "h-[76dvh]" },
      { side: "bottom", size: "xl", class: "h-[92dvh]" },
    ],
    // 36rem is what `max-w-xl` resolved to when the drawer had a single fixed
    // width, so a panel that asks for nothing is the size it has always been.
    defaultVariants: { side: "right", size: "md" },
  },
);

export type SheetSide = NonNullable<VariantProps<typeof sheetContentVariants>["side"]>;
export type SheetSize = NonNullable<VariantProps<typeof sheetContentVariants>["size"]>;

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Which edge the panel is anchored to, and therefore slides in from. */
  readonly side?: SheetSide;
  /** How far the panel reaches in: width on a side panel, height on a bottom sheet. */
  readonly size?: SheetSize;
  /** Hide the default close affordance when the content ships its own. */
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

/* ------------------------------------------------------------------ drawer
 * The record drawer and anything else already calling this a Drawer keeps its
 * names. They are the same component: a right-hand sheet is what "drawer"
 * meant here, and `Sheet` is only the name that survives once it can also
 * come in from the left or the bottom.
 */
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
