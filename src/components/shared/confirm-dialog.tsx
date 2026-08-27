"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
 *
 * The card is the dialog's three bands rather than a hand-measured `p-5` block:
 * a question, its consequence, and the two answers, each in the section that
 * owns its padding. `size="sm"` is the narrow step of the width ladder, which
 * is what a two-button question wants — a wider card sets the description in a
 * single long line and pushes the answers away from the reading eye.
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
      <DialogContent size="sm" className="flex max-h-[85vh] flex-col">
        <DialogHeader size="sm" className="flex items-center gap-3 space-y-0">
          {isDestructive && (
            // Decorative: the title says what is about to happen, and a reader
            // announcing "warning" ahead of it adds nothing it does not
            // already carry.
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-danger/10"
            >
              <TriangleAlert className="size-4 text-danger" />
            </span>
          )}
          <DialogTitle className="min-w-0 flex-1">{title}</DialogTitle>
        </DialogHeader>

        <DialogBody size="sm">
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogBody>

        <DialogFooter size="sm">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {/*
            `isLoading` rather than a swap to "Working…": the label has to stay
            put while the work runs, because a button that changes width under
            a pointer already resting on it is how a second confirmation lands
            on whatever slid into that spot. It disables the button too, so the
            click is still blocked exactly as it was.
          */}
          <Button
            size="sm"
            variant={isDestructive ? "danger" : "default"}
            isLoading={isBusy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
