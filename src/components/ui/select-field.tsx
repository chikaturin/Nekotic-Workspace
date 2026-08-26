import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native select, styled to match the inputs. Keyboard and mobile for free. */
export function SelectField({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-7 min-w-0 rounded-md border border-border bg-surface px-1.5 text-[12px] text-foreground",
        "outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
