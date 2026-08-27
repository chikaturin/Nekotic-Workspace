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
        // `bg-overlay` is already a translucent token, so an opacity modifier
        // on top of it multiplies the two and lightens the scrim. That is how
        // the drawer's copy of this markup ended up dimmer than the dialog's;
        // there is one overlay now, and it takes the token unmodified.
        "fixed inset-0 z-modal bg-overlay backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The X in the corner.
 *
 * Both the dialog and the sheet need it in the same place with the same hit
 * area, and while each surface kept its own copy the two were byte-identical
 * right up until one of them was touched. One component, so the next change
 * lands on both.
 */
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

/* --------------------------------------------------------------------- size
 * Width used to be frozen at one value and eighteen call sites reached past
 * it with a className, in three vocabularies that could not be compared:
 * `max-w-4xl`, `w-[52rem] max-w-[calc(100vw-2rem)]`, `w-[min(46rem,92vw)]
 * max-w-none`. One ladder replaces all three.
 *
 * Every step is expressed as a max-width on purpose. Tailwind-merge resolves
 * `max-w-*` against `max-w-*`, so the call sites that still pass their own
 * width keep winning and keep looking exactly as they do today, and they can
 * be moved onto the ladder one at a time instead of in one risky sweep.
 */
const CENTERED_CARD = [
  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  // A measured width rather than `w-full`, so a wide dialog keeps a gutter on
  // a narrow screen instead of running edge to edge. The size cap below is
  // what actually decides the width on anything bigger than a phone.
  "w-[calc(100vw-2rem)]",
  "rounded-xl border border-border shadow-float",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
].join(" ");

// Taking over the viewport means wanting none of the card chrome — no radius,
// no border, no lift — so `full` replaces the centered block rather than
// layering on top of it.
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
    // 32rem is what `max-w-lg` resolved to back when the width was frozen, so
    // a dialog that never asks for a size renders at exactly the width it has
    // always rendered at.
    defaultVariants: { size: "lg" },
  },
);

export type DialogSize = NonNullable<VariantProps<typeof dialogContentVariants>["size"]>;

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  /** Hide the default close affordance when the content ships its own. */
  readonly hideClose?: boolean;
  /** How wide the card is, or `full` to take over the viewport. */
  readonly size?: DialogSize;
  /**
   * @deprecated Use `size="full"`. Kept as an alias so the call sites that
   * predate the size ladder keep working; remove once they have moved.
   */
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
  // The deprecated boolean wins when it is set, so a call site passing it is
  // unaffected by whatever the `size` default happens to be. Everything else
  // reads `size`, and passing neither lands on the old frozen width.
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

/* ---------------------------------------------------------------- structure
 * The header, the scrolling body and the action row were written by hand in
 * every dialog that has them — six header class strings, five footers, four
 * different top margins on the inline footers. Two axes account for all of
 * the variation, so both are props rather than a fresh string each time.
 *
 * `variant` says what kind of section this is. A `padded` one is a band of
 * the dialog itself: it supplies its own padding and, where a section needs
 * separating from the one below, the rule that does it. An `inline` one sits
 * inside a dialog that already pads its own content, so it supplies neither.
 *
 * `size` picks the density — `sm` for the compact dialogs, `md` for the roomy
 * ones — and is ignored by `inline`, which has no padding to scale.
 */

const dialogHeaderVariants = cva(
  // The close button occupies the top-right corner, so a title allowed to run
  // the full width slides underneath it. This gutter is the fix, and it lives
  // here because eight of the twenty dialogs forgot to write it themselves.
  "shrink-0 space-y-1 pr-12",
  {
    variants: {
      variant: { padded: "border-b border-border", inline: "" },
      size: { sm: "", md: "" },
    },
    compoundVariants: [
      { variant: "padded", size: "sm", class: "px-4 py-3" },
      { variant: "padded", size: "md", class: "px-5 py-4" },
    ],
    defaultVariants: { variant: "padded", size: "md" },
  },
);

const dialogBodyVariants = cva(
  // `min-h-0` is the load-bearing half: a flex child refuses to shrink below
  // its own content without it, so the dialog grows past the viewport and the
  // page scrolls instead of the body. Needs the content to be `flex flex-col`.
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
  // Wrapping rather than overflowing: a footer with three buttons and a hint
  // is wider than a small dialog, and a second row is better than a clipped
  // primary action.
  "flex shrink-0 flex-wrap items-center gap-2",
  {
    variants: {
      // An inline footer is separated by space instead of a rule, and one
      // spacing decision replaces the four different margins in use today.
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
