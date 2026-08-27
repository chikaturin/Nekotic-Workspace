"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Chip } from "@/components/ui/chip";
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
 * Environment label, wearing the shared `Chip` rather than inventing a second
 * dropdown. Moving a document to Production is confirmed, and refused outright
 * for anyone without manage rights.
 *
 * The chip used to be the board's `SelectChip`, imported across two domains
 * because it was the only one of the six copies that happened to be exported.
 * `Chip` is that same shape at `md` — the size the select cell already drew —
 * so the label is unchanged and devtools no longer reaches into a board cell.
 *
 * The confirmation is `ConfirmDialog` rather than a dialog written out here.
 * The one it replaced asked the same question in a narrower card, with tighter
 * padding and a ghost Cancel — three differences that a reader can only read as
 * meaning something, and that meant nothing except that it was written on a
 * different day. This is the app's most consequential confirmation; it should
 * look like the ones guarding a delete, not like a variant of them.
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
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-[var(--disabled-opacity)]"
          >
            <Chip color={current.color}>{current.label}</Chip>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-52">
          <p className="px-1 pb-1 text-micro uppercase tracking-wider text-faint-foreground">
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
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover disabled:opacity-[var(--disabled-opacity)]"
              >
                <Chip color={option.color}>{option.label}</Chip>
                {isBlocked && (
                  <span className="ml-auto text-micro text-faint-foreground">admins only</span>
                )}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        isOpen={pendingProduction}
        title="Point this at Production?"
        description="Production configuration is read by live services. This change is recorded against your account."
        confirmLabel="Switch to Production"
        onConfirm={() => {
          setPendingProduction(false);
          onChange(PRODUCTION_OPTION_ID);
        }}
        onClose={() => setPendingProduction(false)}
      />
    </>
  );
}
