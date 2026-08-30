"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-modal bg-overlay backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

export function DialogCloseButton({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      aria-label="Close"
      className={cn(
        "absolute right-3 top-3 rounded-md p-1 text-muted-foreground outline-none transition-colors",
        "hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <X className="size-4" />
    </DialogPrimitive.Close>
  );
}

const CENTERED_CARD = [
  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "w-[calc(100vw-2rem)]",
  "rounded-xl border border-border shadow-float",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
].join(" ");

const FULLSCREEN_CARD = [
  "inset-0 h-dvh w-screen",
  "data-[state=open]:zoom-in-[0.99] data-[state=open]:slide-in-from-bottom-3",
  "data-[state=closed]:zoom-out-[0.99] data-[state=closed]:slide-out-to-bottom-3",
].join(" ");

const dialogContentVariants = cva(
  [
    "fixed z-modal bg-elevated outline-none",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  ].join(" "),
  {
    variants: {
      size: {
        sm: `${CENTERED_CARD} max-w-[22rem]`,
        md: `${CENTERED_CARD} max-w-[28rem]`,
        lg: `${CENTERED_CARD} max-w-[32rem]`,
        xl: `${CENTERED_CARD} max-w-[42rem]`,
        "2xl": `${CENTERED_CARD} max-w-[56rem]`,
        full: FULLSCREEN_CARD,
      },
    },
    defaultVariants: { size: "lg" },
  },
);

export type DialogSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>;

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  readonly hideClose?: boolean;
  readonly size?: DialogSize;
  readonly fullscreen?: boolean;
}

export function DialogContent({
  className,
  children,
  hideClose = false,
  size,
  fullscreen = false,
  ...props
}: DialogContentProps) {
  const resolvedSize = fullscreen ? "full" : size;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-fullscreen={resolvedSize === "full" ? "" : undefined}
        className={cn(dialogContentVariants({ size: resolvedSize }), className)}
        {...props}
      >
        {children}
        {!hideClose && <DialogCloseButton />}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-title font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-ui text-muted-foreground", className)}
      {...props}
    />
  );
}

const dialogHeaderVariants = cva(
  "shrink-0 space-y-1",
  {
    variants: {
      variant: { padded: "border-b border-border", inline: "pr-12" },
      size: { sm: "", md: "" },
    },
    compoundVariants: [
      { variant: "padded", size: "sm", class: "py-3 pl-4 pr-12" },
      { variant: "padded", size: "md", class: "py-4 pl-5 pr-12" },
    ],
    defaultVariants: { variant: "padded", size: "md" },
  },
);

const dialogBodyVariants = cva(
  "min-h-0 flex-1 overflow-y-auto",
  {
    variants: {
      variant: { padded: "", inline: "" },
      size: { sm: "", md: "" },
    },
    compoundVariants: [
      { variant: "padded", size: "sm", class: "px-4 py-3" },
      { variant: "padded", size: "md", class: "px-5 py-4" },
    ],
    defaultVariants: { variant: "padded", size: "md" },
  },
);

const dialogFooterVariants = cva(
  "flex shrink-0 flex-wrap items-center gap-2",
  {
    variants: {
      variant: { padded: "border-t border-border", inline: "mt-5" },
      size: { sm: "", md: "" },
      align: { end: "justify-end", start: "justify-start" },
    },
    compoundVariants: [
      { variant: "padded", size: "sm", class: "px-4 py-2.5" },
      { variant: "padded", size: "md", class: "px-5 py-3" },
    ],
    defaultVariants: { variant: "padded", size: "md", align: "end" },
  },
);

type DialogSectionVariants = VariantProps<typeof dialogHeaderVariants>;

export function DialogHeader({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"header"> & DialogSectionVariants) {
  return (
    <header className={cn(dialogHeaderVariants({ variant, size }), className)} {...props} />
  );
}

export function DialogBody({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"div"> & DialogSectionVariants) {
  return <div className={cn(dialogBodyVariants({ variant, size }), className)} {...props} />;
}

export function DialogFooter({
  className,
  variant,
  size,
  align,
  ...props
}: ComponentProps<"footer"> & VariantProps<typeof dialogFooterVariants>) {
  return (
    <footer
      className={cn(dialogFooterVariants({ variant, size, align }), className)}
      {...props}
    />
  );
}

export { dialogContentVariants };
