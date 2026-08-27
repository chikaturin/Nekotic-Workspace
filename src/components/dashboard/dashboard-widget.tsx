"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BUCKET_BAR_CLASSES } from "@/lib/dashboard";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardWidget as Widget } from "@/types";

interface DashboardWidgetProps {
  readonly widget: Widget;
  readonly icon: LucideIcon;
  readonly onOpenSource: (nodeId: string) => void;
}

/**
 * One widget (SY-DSH-44): a proportion, the numbers behind it, and where the
 * numbers came from.
 *
 * A count you cannot trace is not much use, so every card names the boards it
 * read and says plainly how many records it could not place.
 */
export function DashboardWidget({ widget, icon: Icon, onOpenSource }: DashboardWidgetProps) {
  const isEmpty = widget.total === 0;

  return (
    <section
      aria-labelledby={`widget-${widget.id}`}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-3.5"
    >
      <header className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated">
          <Icon className="size-4 text-accent" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <h2 id={`widget-${widget.id}`} className="text-lead font-medium text-foreground">
            {widget.label}
          </h2>
          <p className="truncate text-body text-faint-foreground">{widget.description}</p>
        </div>

        <span className="metric shrink-0 text-xl font-semibold tabular-nums text-foreground">
          {widget.total}
        </span>
      </header>

      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-ui text-faint-foreground">
          No records reach this widget yet.
        </p>
      ) : (
        <>
          <div
            className="flex h-1.5 overflow-hidden rounded-full bg-hairline"
            role="img"
            aria-label={widget.buckets
              .map((bucket) => `${bucket.label} ${bucket.count}`)
              .join(", ")}
          >
            {widget.buckets
              .filter((bucket) => bucket.count > 0)
              .map((bucket) => (
                <motion.span
                  key={bucket.id}
                  initial={{ flexGrow: 0 }}
                  animate={{ flexGrow: bucket.count }}
                  transition={{ type: "spring", stiffness: 220, damping: 30 }}
                  className={cn("block", BUCKET_BAR_CLASSES[bucket.color])}
                />
              ))}
          </div>

          <ul className="flex flex-col gap-1">
            {widget.buckets.map((bucket) => (
              <li key={bucket.id} className="flex items-center gap-2 text-ui">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", BUCKET_BAR_CLASSES[bucket.color])}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{bucket.label}</span>
                <span className="metric tabular-nums text-foreground">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-2 text-body">
        {widget.sources.length > 0 ? (
          widget.sources.map((source) => (
            <button
              key={source.nodeId}
              type="button"
              onClick={() => onOpenSource(source.nodeId)}
              className="rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              {source.name}
              <span className="metric ml-1 tabular-nums text-faint-foreground">{source.count}</span>
            </button>
          ))
        ) : (
          <span className="text-faint-foreground">No board contributes to this yet</span>
        )}

        {/* Reported rather than folded into the nearest bucket. */}
        {widget.unmapped > 0 && (
          <span className="ml-auto text-faint-foreground">
            {formatCount(widget.unmapped, "record")} in another state
          </span>
        )}
      </footer>
    </section>
  );
}
