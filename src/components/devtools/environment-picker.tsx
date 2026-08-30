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
  readonly canManage: boolean;
  readonly onChange: (optionId: string) => void;
}

export function environmentOption(optionId: string): SelectOption {
  return (
    ENVIRONMENT_OPTIONS.find((option) => option.id === optionId) ?? ENVIRONMENT_OPTIONS[0]!
  );
}

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
