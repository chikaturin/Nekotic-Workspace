import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, children, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "metric inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 text-micro text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
