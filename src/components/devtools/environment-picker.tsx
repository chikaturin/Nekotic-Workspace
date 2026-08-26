"use client";

import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { SelectChip } from "@/components/board/cells/select-cell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ENVIRONMENT_OPTIONS, PRODUCTION_OPTION_ID } from "@/lib/board-templates";
import type { SelectOption } from "@/types";

interface EnvironmentPickerProps {
  readonly optionId: string;
  readonly canEdit: boolean;
  /** Only managers may point a document at Production (DV-ENV-21). */
  readonly canManage: boolean;
  readonly onChange: (optionId: string) => void;
}

export function environmentOption(optionId: string): SelectOption {
  return (
    ENVIRONMENT_OPTIONS.find((option) => option.id === optionId) ?? ENVIRONMENT_OPTIONS[0]!
  );
}

/**
 * Environment label, reusing the board's select chip rather than inventing a
 * second dropdown. Moving a document to Production is confirmed, and refused
 * outright for anyone without manage rights.
 */
export function EnvironmentPicker({
  optionId,
  canEdit,
  canManage,
  onChange,
}: EnvironmentPickerProps) {
  const [pendingProduction, setPendingProduction] = useState(false);
  const current = environmentOption(optionId);

  function choose(next: string) {
    if (next === PRODUCTION_OPTION_ID && optionId !== PRODUCTION_OPTION_ID) {
      setPendingProduction(true);
      return;
    }

    onChange(next);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!canEdit}
            aria-label="Environment"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <SelectChip option={current} />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-52">
          <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-faint-foreground">
            Environment
          </p>
          {ENVIRONMENT_OPTIONS.map((option) => {
            const isProduction = option.id === PRODUCTION_OPTION_ID;
            const isBlocked = isProduction && !canManage;

            return (
              <button
                key={option.id}
                type="button"
                disabled={isBlocked}
                onClick={() => choose(option.id)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover disabled:opacity-50"
              >
                <SelectChip option={option} />
                {isBlocked && (
                  <span className="ml-auto text-[10px] text-faint-foreground">admins only</span>
                )}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <Dialog open={pendingProduction} onOpenChange={setPendingProduction}>
        <DialogContent className="max-w-sm p-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldAlert className="size-4 text-danger" />
            Point this at Production?
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] text-muted-foreground">
            Production configuration is read by live services. This change is recorded against your
            account.
          </DialogDescription>

          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingProduction(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setPendingProduction(false);
                onChange(PRODUCTION_OPTION_ID);
              }}
            >
              Switch to Production
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
