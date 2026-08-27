"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every gallery entry renders in.
 *
 * A component library page is only useful if the states are on screen next to
 * each other — the reason five different disabled treatments survived in this
 * app for so long is that nobody ever saw two of them at once.
 */

export function Section({
  id,
  title,
  summary,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-hairline pt-6">
      <h2 className="text-title font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-2xl text-ui text-muted-foreground">{summary}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function Row({
  label,
  note,
  children,
  isColumn = false,
}: {
  readonly label: string;
  readonly note?: string;
  readonly children: ReactNode;
  /** Stack instead of inlining — for controls that want their full width. */
  readonly isColumn?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <div className="pt-1">
        <p className="text-body font-medium text-foreground">{label}</p>
        {note && <p className="mt-0.5 text-micro text-faint-foreground">{note}</p>}
      </div>
      <div
        className={cn(
          "min-w-0 rounded-lg border border-hairline bg-surface p-3",
          isColumn ? "space-y-2.5" : "flex flex-wrap items-center gap-2.5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A swatch grid for the token sections, where the value is the point. */
export function TokenGrid({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}

export function TokenCard({
  name,
  value,
  children,
}: {
  readonly name: string;
  readonly value: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-2.5">
      {children}
      <p className="metric mt-2 truncate text-micro text-foreground">{name}</p>
      <p className="metric truncate text-micro text-faint-foreground">{value}</p>
    </div>
  );
}
