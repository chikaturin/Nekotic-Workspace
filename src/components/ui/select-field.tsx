import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const selectShellVariants = cva("relative inline-flex min-w-0 items-center text-foreground", {
  variants: {
    size: {
      xs: "h-[var(--control-xs)] [--select-pad:var(--control-pad-xs)] [--select-chevron:var(--icon-xs)]",
      sm: "h-[var(--control-sm)] [--select-pad:var(--control-pad-sm)] [--select-chevron:var(--icon-sm)]",
      md: "h-[var(--control-md)] [--select-pad:var(--control-pad-md)] [--select-chevron:var(--icon-md)]",
    },
  },
  defaultVariants: { size: "md" },
});

const selectControlVariants = cva(
  [
    "block h-full cursor-pointer appearance-none",
    "pr-[calc(var(--select-pad)+var(--select-chevron)+0.25rem)]",
  ].join(" "),
  {
    variants: {
      size: { xs: "text-body", sm: "text-ui", md: "text-ui" },
    },
    defaultVariants: { size: "md" },
  },
);

export type SelectFieldProps = Omit<ComponentProps<"select">, "size"> &
  VariantProps<typeof inputVariants>;

export function SelectField({
  className,
  variant,
  size,
  disabled = false,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <span
      data-slot="select-field"
      className={cn(selectShellVariants({ size }), className)}
    >
      <select
        data-slot="select"
        disabled={disabled}
        className={cn(inputVariants({ variant, size }), selectControlVariants({ size }))}
        {...props}
      >
        {children}
      </select>

      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 right-[var(--select-pad)] -translate-y-1/2",
          "size-[var(--select-chevron)] text-faint-foreground",
          disabled && "is-disabled",
        )}
      />
    </span>
  );
}

export { selectShellVariants };
