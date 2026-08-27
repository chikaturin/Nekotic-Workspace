"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type FeedbackTone } from "@/store/workspace-store";

const AUTO_DISMISS_MS = 3800;

/*
 * Both maps are keyed by the tone union rather than written as free-standing
 * objects, so adding a tone to the store is a type error here — in the two
 * places that have to answer for it — instead of a toast that renders the info
 * glyph in the muted colour because nobody remembered this file existed.
 */
const TONE_ICON: Record<FeedbackTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  error: CircleAlert,
};

const TONE_CLASS: Record<FeedbackTone, string> = {
  info: "text-muted-foreground",
  success: "text-success",
  error: "text-danger",
};

/**
 * The one toast surface, for move / upload / trash confirmations.
 *
 * Known defect, and it is in the store rather than here: `feedback` is a single
 * slot on the workspace store, so a second `pushFeedback` while a toast is on
 * screen overwrites the first message outright. Nobody sees the one that was
 * replaced, and the timer belonging to the replaced message keeps running — a
 * fast second push shortens the survivor's dwell to whatever was left of the
 * first one's. Both board-store and upload-store push several in a row, so this
 * is routine rather than theoretical. Fixing it means a queue on the store
 * (`feedback: readonly Feedback[]`, shift on dismiss); this component then
 * renders the head of the queue and stacks the rest. Left alone here on
 * purpose: the store is not this change's to touch.
 */
export function FeedbackToast() {
  const feedback = useWorkspaceStore((state) => state.feedback);
  const dismissFeedback = useWorkspaceStore((state) => state.dismissFeedback);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(dismissFeedback, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [feedback, dismissFeedback]);

  const Icon = feedback ? TONE_ICON[feedback.tone] : Info;

  return (
    /*
     * The live region is this wrapper, which is mounted for the life of the
     * app, rather than the toast inside it. A region that arrives in the same
     * frame as its own text is frequently not announced at all — the reader
     * has nothing to diff it against — whereas text appearing inside a region
     * that was already there is the case every screen reader handles.
     */
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-toast -translate-x-1/2"
    >
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border bg-elevated py-1.5 pl-3.5 pr-1.5 shadow-float"
          >
            <Icon aria-hidden="true" className={cn("size-4 shrink-0", TONE_CLASS[feedback.tone])} />
            <span className="text-lead text-foreground">{feedback.message}</span>
            <IconButton
              aria-label="Dismiss"
              variant="ghost"
              className="rounded-full"
              onClick={dismissFeedback}
            >
              <X />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
