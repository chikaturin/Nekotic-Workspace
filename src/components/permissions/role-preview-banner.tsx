"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/permissions";
import { selectPreviewRole, usePermissionStore } from "@/store/permission-store";

/**
 * Standing reminder while the app is being previewed as another role.
 *
 * Without it a manager wonders why the column menu vanished. It never appears
 * unprompted: the preview is opt-in, and previewing can only ever *remove*
 * affordances, never add one.
 */
export function RolePreviewBanner() {
  const previewRole = usePermissionStore(selectPreviewRole);
  const setPreviewRole = usePermissionStore((state) => state.setPreviewRole);

  return (
    <AnimatePresence>
      {previewRole && (
        <motion.div
          initial={{ y: -32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-accent/30 bg-accent-soft px-4 py-1.5"
        >
          <Eye className="size-3.5 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate text-[12px] text-foreground">
            Previewing as <strong className="font-medium">{ROLE_LABELS[previewRole]}</strong> — the
            interface is narrowed to what that role may do.
          </p>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setPreviewRole(null)}>
            <X />
            Exit preview
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
