"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { RotateCcw, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { AppError } from "@/types";

interface StatePanelAction {
  readonly label: string;
  /** A link instead of a handler — "back to the workspace root" and friends. */
  readonly href?: string;
  readonly onClick?: () => void;
}

/**
 * How much the panel is claiming.
 *
 * `neutral` is "there is nothing here yet", which is the ordinary state of an
 * empty list and should not be dressed up as a fault. `danger` is "something
 * failed". `warning` is the step between them that was missing: the request
 * worked and the answer is unwelcome — a path that no longer resolves — which
 * a red panel overstates and a grey one understates, leaving the caution icon
 * sitting in chrome that disagrees with it.
 */
export type StatePanelTone = "neutral" | "warning" | "danger";

/*
 * Built the same way as the badge ramp — a tenth of the colour behind it, a
 * third of it on the border, the colour itself on the glyph — so a state panel
 * and a status badge on the same screen read as one family, and a fourth tone
 * is two lines rather than a design decision.
 */
const TONE_FRAME: Record<StatePanelTone, string> = {
  neutral: "border-border bg-surface",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-danger/30 bg-danger/10",
};

const TONE_GLYPH: Record<StatePanelTone, string> = {
  neutral: "text-faint-foreground",
  warning: "text-warning",
  danger: "text-danger",
};

interface StatePanelProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly tone?: StatePanelTone;
  readonly action?: StatePanelAction;
  readonly className?: string;
  /** Retry is the common case, so the icon is opt-out rather than opt-in. */
  readonly hasActionIcon?: boolean;
}

/** Shared shell for the non-happy paths so they all read the same. */
export function StatePanel({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  action,
  className,
  hasActionIcon = true,
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
      {/* `shadow-raise` is the shallowest step on the elevation ladder and is
          what stops the frame reading as a hole in the canvas: it is the same
          lift a button carries, which is the note this glyph wants — present,
          not floating. */}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-12 items-center justify-center rounded-xl border shadow-raise",
          TONE_FRAME[tone],
        )}
      >
        <Icon className={cn("size-5", TONE_GLYPH[tone])} strokeWidth={1.5} />
      </span>

      <div className="space-y-1">
        {/* The title is the section heading for whatever is missing, so it
            takes the title step rather than sharing the body step with the
            sentence under it — with both at 13px the only thing separating
            them was the font weight. */}
        <p className="text-title font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-lead text-muted-foreground">{description}</p>
      </div>

      {action &&
        (action.href ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {hasActionIcon && <RotateCcw />}
            {action.label}
          </Button>
        ))}
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
    <span className="flex items-center gap-1.5 text-body text-muted-foreground">
      {/* The label is right there in the markup, so the spinner stays silent
          rather than announcing the same word a second time as its own live
          region. */}
      <Spinner size="sm" />
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
