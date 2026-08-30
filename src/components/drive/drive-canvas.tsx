"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload } from "lucide-react";
import type { ReactNode } from "react";
import { useDropTarget } from "@/hooks/use-node-dnd";
import { cn } from "@/lib/utils";

interface DriveCanvasProps {
  readonly targetId: string | null;
  readonly targetName: string;
  readonly children: ReactNode;
}

export function DriveCanvas({ targetId, targetName, children }: DriveCanvasProps) {
  const { dropProps, isOver } = useDropTarget({ targetId });

  return (
    <div
      {...dropProps}
      className={cn(
        "relative min-h-full rounded-xl border border-dashed p-4 transition-colors",
        isOver ? "border-accent bg-accent-soft/40" : "border-transparent",
      )}
    >
      {children}

      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute inset-3 z-overlay flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-background/70 backdrop-blur-[1px]"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <motion.span
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"
              >
                <CloudUpload className="size-5" />
              </motion.span>
              <p className="text-lead font-medium text-foreground">Drop into {targetName}</p>
              <p className="metric text-body text-muted-foreground">
                Files upload here · items move here
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
