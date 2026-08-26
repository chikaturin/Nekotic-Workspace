"use client";

import { motion } from "framer-motion";
import { LoaderCircle, RotateCcw, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AppError } from "@/types";

interface StatePanelProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly tone?: "neutral" | "danger";
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly className?: string;
}

/** Shared shell for the non-happy paths so they all read the same. */
export function StatePanel({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  action,
  className,
}: StatePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-xl border",
          tone === "danger" ? "border-danger/30 bg-danger/10" : "border-border bg-surface",
        )}
      >
        <Icon
          className={cn("size-5", tone === "danger" ? "text-danger" : "text-faint-foreground")}
          strokeWidth={1.5}
        />
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">{description}</p>
      </div>

      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="gap-1.5">
          <RotateCcw />
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  return (
    <StatePanel
      icon={TriangleAlert}
      tone="danger"
      title={error.message}
      description={error.detail ?? "The request did not complete. Nothing was changed."}
      action={error.isRetryable && onRetry ? { label: "Try again", onClick: onRetry } : undefined}
    />
  );
}

export function PermissionDeniedState({ error }: { error: AppError }) {
  return (
    <StatePanel
      icon={ShieldAlert}
      title={error.message}
      description={error.detail ?? "Ask a workspace admin to grant you access."}
    />
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <LoaderCircle className="size-3 animate-spin" />
      {label}
    </span>
  );
}

/** Row skeletons matching the file table layout. */
export function ListLoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5 p-1" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-md px-2.5 py-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-3 flex-1" style={{ maxWidth: `${60 - index * 6}%` }} />
          <Skeleton className="hidden h-3 w-16 sm:block" />
          <Skeleton className="hidden h-3 w-24 lg:block" />
        </div>
      ))}
    </div>
  );
}
