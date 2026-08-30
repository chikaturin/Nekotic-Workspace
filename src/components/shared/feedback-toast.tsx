"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type FeedbackTone } from "@/store/workspace-store";

const AUTO_DISMISS_MS = 3800;

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
