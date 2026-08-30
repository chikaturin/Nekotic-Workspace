import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    "flex w-full min-w-0 rounded-md text-foreground outline-none transition-colors",
    "placeholder:text-faint-foreground",
    "focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]",
    "aria-invalid:border-danger aria-invalid:ring-danger/30",
    "aria-invalid:hover:border-danger",
    "aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/30",
  ],
  {
    variants: {
      variant: {
        default: "border border-border bg-surface hover:border-border-strong focus-visible:border-accent",
        ghost: "border border-transparent bg-transparent hover:border-border focus-visible:border-accent",
      },
      size: {
        xs: "h-[var(--control-xs)] px-[var(--control-pad-xs)] text-body",
        sm: "h-[var(--control-sm)] px-[var(--control-pad-sm)] text-ui",
        md: "h-[var(--control-md)] px-[var(--control-pad-md)] text-ui",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

export function Input({ className, type = "text", variant, size, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { inputVariants };
