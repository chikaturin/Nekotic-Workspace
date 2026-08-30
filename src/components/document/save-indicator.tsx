"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CloudUpload, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClockTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SaveState } from "@/types";

interface SaveIndicatorProps {
  readonly state: SaveState;
  readonly onRetry: () => void;
  readonly isReadOnly?: boolean;
}

export function SaveIndicator({ state, onRetry, isReadOnly = false }: SaveIndicatorProps) {
  if (isReadOnly) {
    return (
      <span className="metric flex items-center gap-1.5 text-body text-faint-foreground">
        Read only
      </span>
    );
  }

  const key = state.status === "idle" && state.hasPendingChanges ? "pending" : state.status;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={key}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.14 }}
        role="status"
        aria-live="polite"
        className={cn(
          "metric flex items-center gap-1.5 text-body",
          state.status === "error" ? "text-danger" : "text-faint-foreground",
        )}
      >
        {key === "saving" && (
          <>
            <LoaderCircle className="size-3 animate-spin text-accent" />
            Saving…
          </>
        )}

        {key === "saved" && (
          <>
            <CircleCheck className="size-3 text-success" />
            Saved
            {state.lastSavedAt && (
              <span className="text-faint-foreground">· {formatClockTime(state.lastSavedAt)}</span>
            )}
          </>
        )}

        {key === "pending" && (
          <>
            <CloudUpload className="size-3" />
            Unsaved changes
          </>
        )}

        {key === "error" && (
          <>
            <TriangleAlert className="size-3" />
            {state.error ?? "Could not save"}
            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-body" onClick={onRetry}>
              Retry
            </Button>
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );
}
