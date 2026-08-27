"use client";

import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react";
import { ImportMappingStep } from "@/components/board/import/import-mapping-step";
import { ImportResultStep } from "@/components/board/import/import-result-step";
import { ImportUploadStep } from "@/components/board/import/import-upload-step";
import { ImportValidationStep } from "@/components/board/import/import-validation-step";
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
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useImportWizard } from "@/hooks/use-import-wizard";
import { cn } from "@/lib/utils";
import type { ImportStep } from "@/types";

interface ImportDialogProps {
  readonly isOpen: boolean;
  readonly model: BoardViewModel;
  readonly onClose: () => void;
}

const STEPS: readonly { readonly id: ImportStep; readonly label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map columns" },
  { id: "validation", label: "Validate" },
  { id: "result", label: "Result" },
];

/**
 * The import wizard (SY-IMP-35).
 *
 * Four steps, and the board is untouched until the fourth. Everything the user
 * decides — which column feeds which, what to do with values that will not
 * parse — is decided against a preview computed from the file itself.
 */
export function ImportDialog({ isOpen, model, onClose }: ImportDialogProps) {
  const wizard = useImportWizard(model);
  const stepIndex = STEPS.findIndex((step) => step.id === wizard.step);

  function close() {
    onClose();
    wizard.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="2xl" className="flex max-h-[86vh] flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-accent" />
            Import into {model.board?.name ?? "this board"}
          </DialogTitle>
          <DialogDescription>
            Nothing is written to the board until you confirm on the last step.
          </DialogDescription>

          <ol className="mt-3 flex flex-wrap items-center gap-1.5">
            {STEPS.map((step, index) => (
              <li key={step.id} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-body",
                    index === stepIndex
                      ? "border-accent bg-accent-soft text-accent"
                      : index < stepIndex
                        ? "border-transparent bg-hover text-muted-foreground"
                        : "border-transparent text-faint-foreground",
                  )}
                >
                  {index < stepIndex ? (
                    <Check className="size-3" />
                  ) : (
                    <span className="metric">{index + 1}</span>
                  )}
                  {step.label}
                </span>
                {index < STEPS.length - 1 && (
                  <ArrowRight className="size-3 text-faint-foreground" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        </DialogHeader>

        {/* `inline` because every step pads itself — the body only has to be
            the part of the card that scrolls. */}
        <DialogBody variant="inline">
          {wizard.step === "upload" && (
            <ImportUploadStep
              error={wizard.error}
              isBusy={wizard.isBusy}
              onFile={(file) => void wizard.selectFile(file)}
            />
          )}

          {wizard.step === "mapping" && wizard.source && (
            <ImportMappingStep
              source={wizard.source}
              columns={model.columns}
              mappings={wizard.mappings}
              hasHeaderRow={wizard.hasHeaderRow}
              wasTruncated={wizard.wasTruncated}
              onSetHeaderRow={wizard.setHasHeaderRow}
              onSetMapping={wizard.setMapping}
            />
          )}

          {wizard.step === "validation" && wizard.plan && (
            <ImportValidationStep
              plan={wizard.plan}
              policy={wizard.policy}
              onSetPolicy={wizard.setPolicy}
            />
          )}

          {wizard.step === "result" && wizard.outcome && (
            <ImportResultStep outcome={wizard.outcome} />
          )}
        </DialogBody>

        <DialogFooter align="start">
          {wizard.step === "mapping" && (
            <Button size="sm" variant="ghost" onClick={() => wizard.reset()}>
              <ArrowLeft />
              Choose another file
            </Button>
          )}

          {wizard.step === "validation" && (
            <Button size="sm" variant="ghost" onClick={() => wizard.goTo("mapping")}>
              <ArrowLeft />
              Back to mapping
            </Button>
          )}

          <span className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={close}>
              {wizard.step === "result" ? "Done" : "Cancel"}
            </Button>

            {wizard.step === "mapping" && (
              <Button
                size="sm"
                variant="default"
                disabled={(wizard.plan?.mappedColumnCount ?? 0) === 0}
                title={
                  (wizard.plan?.mappedColumnCount ?? 0) === 0
                    ? "Map at least one column first"
                    : undefined
                }
                onClick={() => wizard.goTo("validation")}
              >
                Validate
                <ArrowRight />
              </Button>
            )}

            {wizard.step === "validation" && wizard.plan && (
              <Button
                size="sm"
                variant="default"
                // `isLoading` blocks the click and swaps the leading check for
                // the spinner, which is the pair of things the hand-rolled
                // version did with a ternary and a separate `disabled`.
                isLoading={wizard.isBusy}
                onClick={() => void wizard.confirm()}
              >
                <Check />
                Import{" "}
                {wizard.policy === "skip"
                  ? wizard.plan.validCount
                  : wizard.plan.validCount + wizard.plan.invalidCount}{" "}
                rows
              </Button>
            )}
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
