import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      xs: "size-2.5",
      sm: "size-3",
      md: "size-3.5",
      lg: "size-4",
    },
  },
  defaultVariants: { size: "md" },
});

export type SpinnerProps = ComponentProps<"span"> &
  VariantProps<typeof spinnerVariants> & {
    readonly label?: string;
  };

export function Spinner({ className, size, label, ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle aria-hidden="true" className={spinnerVariants({ size })} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export { spinnerVariants };
