"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description: string;
  /** What the confirm button says — a verb, never "OK". */
  readonly confirmLabel: string;
  readonly isDestructive?: boolean;
  readonly isBusy?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

/**
 * The one confirmation surface. Irreversible actions — purging from Trash,
 * deleting records outright — go through it so the wording, the focus order
 * and the escape hatch are the same wherever they are asked for.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isDestructive = true,
  isBusy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-5">
        <div className="flex gap-3">
          {isDestructive && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger/10">
              <TriangleAlert className="size-4 text-danger" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold text-foreground">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={isDestructive ? "danger" : "default"}
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
