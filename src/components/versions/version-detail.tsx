"use client";

import { FileClock } from "lucide-react";
import { useMemo } from "react";
import { describeDiff, diffLines, summarizeDiff } from "@/lib/diff";
import { cn } from "@/lib/utils";
import type { DiffLine, VersionEntry } from "@/types";

export type VersionMode = "view" | "compare";

interface VersionDetailProps {
  readonly entry: VersionEntry | null;
  readonly mode: VersionMode;
  readonly currentLines: readonly string[];
}

const KIND_CLASS: Readonly<Record<DiffLine["kind"], string>> = {
  same: "text-muted-foreground",
  added: "bg-success/10 text-success",
  removed: "bg-danger/10 text-danger",
};

const KIND_MARK: Readonly<Record<DiffLine["kind"], string>> = {
  same: " ",
  added: "+",
  removed: "−",
};

/**
 * The right-hand side of the history: a version as it was, or what changed
 * between it and the content on screen. Added lines are green, removed lines
 * are red — the comparison the PRD asks for, and nothing else.
 */
export function VersionDetail({ entry, mode, currentLines }: VersionDetailProps) {
  const lines = useMemo<readonly DiffLine[]>(() => {
    if (!entry) return [];
    if (mode === "view") return entry.lines.map((text) => ({ kind: "same", text }));

    return diffLines(entry.lines, currentLines);
  }, [entry, mode, currentLines]);

  const summary = useMemo(() => summarizeDiff(lines), [lines]);

  if (!entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <FileClock className="size-5 text-faint-foreground" />
        <p className="text-ui text-muted-foreground">
          Pick a version to read it, or compare it with what is on screen now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-baseline gap-2 border-b border-hairline px-3 py-2">
        <span className="text-ui font-medium text-foreground">
          {mode === "view" ? `Version ${entry.version}` : `Version ${entry.version} → now`}
        </span>
        {mode === "compare" && (
          <span className="metric ml-auto text-micro text-faint-foreground">
            {describeDiff(summary)}
          </span>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-2">
        <pre className="min-w-max text-body leading-relaxed">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn("flex gap-2 rounded px-1.5", KIND_CLASS[line.kind])}
            >
              <span aria-hidden className="metric w-3 shrink-0 select-none opacity-60">
                {KIND_MARK[line.kind]}
              </span>
              <span className="whitespace-pre-wrap break-words">{line.text || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
