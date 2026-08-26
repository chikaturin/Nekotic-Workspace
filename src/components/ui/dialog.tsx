"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Hide the default close affordance when the content ships its own. */
  readonly hideClose?: boolean;
  /** Take over the whole viewport instead of floating as a centered card. */
  readonly fullscreen?: boolean;
}

const CENTERED_CONTENT = [
  "left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
  "rounded-xl border border-border shadow-2xl",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
].join(" ");

const FULLSCREEN_CONTENT = [
  "inset-0 h-dvh w-screen",
  "data-[state=open]:zoom-in-[0.99] data-[state=open]:slide-in-from-bottom-3",
  "data-[state=closed]:zoom-out-[0.99] data-[state=closed]:slide-out-to-bottom-3",
].join(" ");

export function DialogContent({
  className,
  children,
  hideClose = false,
  fullscreen = false,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-fullscreen={fullscreen ? "" : undefined}
        className={cn(
          "fixed z-50 bg-elevated outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          fullscreen ? FULLSCREEN_CONTENT : CENTERED_CONTENT,
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
