"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-[var(--disabled-opacity)] [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-raise",
        outline: "border border-border bg-surface text-foreground hover:bg-hover hover:border-border-strong",
        ghost: "text-muted-foreground hover:bg-hover hover:text-foreground",
        subtle: "bg-hover text-foreground hover:bg-elevated",
        danger: "bg-danger/12 text-danger hover:bg-danger/20",
        link: "text-accent underline-offset-4 hover:underline",
      },
      /* Height, padding and type step move together, because they are one
       * decision: a 28px button with 12px of padding and a 12px label is a
       * different control than a 28px button, not a smaller one. Heights come
       * from the shared control ladder so a Button, an Input and a Select
       * placed side by side in a toolbar line up without anyone measuring. */
      size: {
        xs: "h-[var(--control-xs)] px-[var(--control-pad-xs)] text-body [&_svg]:size-3",
        sm: "h-[var(--control-sm)] px-[var(--control-pad-sm)] text-body [&_svg]:size-3.5",
        default: "h-[var(--control-md)] px-[var(--control-pad-md)] text-ui [&_svg]:size-4",
        // The same step under the name the density ladder uses. `default` is
        // kept so no existing call site moves, but every other control in the
        // system spells 32px `md`, and `<Input size="md">` beside
        // `<Button size="md">` should not be a type error.
        md: "h-[var(--control-md)] px-[var(--control-pad-md)] text-ui [&_svg]:size-4",
        lg: "h-[var(--control-lg)] px-[var(--control-pad-lg)] text-ui [&_svg]:size-4",
        icon: "size-[var(--control-md)] [&_svg]:size-4",
        "icon-sm": "size-[var(--control-sm)] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "ghost", size: "default" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean;
    /**
     * Swaps the leading icon for a spinner, marks the button busy and blocks
     * further clicks. The label is deliberately left in place: hiding it
     * shrinks the button under the pointer that is still on it, which is how
     * a second submit lands on whatever moved into that spot.
     */
    readonly isLoading?: boolean;
  };

/**
 * Replaces a leading icon with the spinner, or prepends one if the button is
 * all text. `Children.toArray` hands back strings for text nodes, so a first
 * child that is an element is the icon and a first child that is a string is
 * the label — which is the whole distinction we need. A button whose entire
 * content is one wrapper element is read as icon-only and gets swapped; that
 * is the right answer for an icon button and the reason not to wrap a label
 * in a bare `<span>` here.
 */
function withLeadingSpinner(children: ReactNode): ReactNode {
  const items = Children.toArray(children);
  const [leading, ...rest] = items;
  const spinner = <Spinner key="button-spinner" />;

  return isValidElement(leading) ? [spinner, ...rest] : [spinner, ...items];
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-loading={isLoading ? "" : undefined}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {/* Slot demands exactly one child and the consumer owns that element's
          insides, so composed buttons keep their own content and only get the
          busy flag. The spinner takes its size from the size variant's
          `[&_svg]` rule, which outranks the spinner's own class. */}
      {isLoading && !asChild ? withLeadingSpinner(children) : children}
    </Comp>
  );
}

export { buttonVariants };
