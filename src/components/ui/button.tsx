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
      size: {
        xs: "h-[var(--control-xs)] px-[var(--control-pad-xs)] text-body [&_svg]:size-3",
        sm: "h-[var(--control-sm)] px-[var(--control-pad-sm)] text-body [&_svg]:size-3.5",
        default: "h-[var(--control-md)] px-[var(--control-pad-md)] text-ui [&_svg]:size-4",
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
    readonly isLoading?: boolean;
  };

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
      {...(asChild ? {} : { type: "button" as const })}
      data-loading={isLoading ? "" : undefined}
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {isLoading && !asChild ? withLeadingSpinner(children) : children}
    </Comp>
  );
}

export { buttonVariants };
