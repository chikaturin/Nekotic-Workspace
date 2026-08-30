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
  readonly confirmLabel: string;
  readonly isDestructive?: boolean;
  readonly isBusy?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

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
