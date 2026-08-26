import { cn } from "@/lib/utils";

interface ProgressProps {
  /** 0 – 1. */
  readonly value: number;
  readonly className?: string;
  readonly indicatorClassName?: string;
  readonly label?: string;
}

export function Progress({ value, className, indicatorClassName, label }: ProgressProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-hover", className)}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-200", indicatorClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
