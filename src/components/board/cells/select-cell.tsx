"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CellShell, UnparsedBadge } from "@/components/board/cells/cell-frame";
import { EditorSurface } from "@/components/board/cells/cell-frame";
import { Input } from "@/components/ui/input";
import { findOptionByLabel, SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { cn } from "@/lib/utils";
import type { BoardColumnOf, CellValue, SelectOption } from "@/types";

type SelectValue = Extract<CellValue, { kind: "select" }>;

export function SelectChip({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        SELECT_COLOR_CLASSES[option.color],
      )}
    >
      <span className="truncate">{option.label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${option.label}`}>
          <X className="size-3 opacity-60 hover:opacity-100" />
        </button>
      )}
    </span>
  );
}

export function SelectCellView({
  value,
  column,
}: {
  value: SelectValue;
  column: BoardColumnOf<"select">;
}) {
  const chips = value.optionIds
    .map((id) => column.config.options.find((option) => option.id === id))
    .filter((option): option is SelectOption => Boolean(option));

  return (
    <CellShell>
      {chips.length > 0 ? (
        chips.map((option) => <SelectChip key={option.id} option={option} />)
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface SelectEditorProps {
  readonly value: SelectValue;
  readonly column: BoardColumnOf<"select">;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
  /** Creating an option is a schema write, so the board store owns it. */
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
}

/** Typing a word that matches nothing offers to create the option there and then. */
export function SelectCellEditor({
  value,
  column,
  onCommit,
  onCancel,
  onCreateOption,
}: SelectEditorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>(value.optionIds);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return column.config.options;
    return column.config.options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [column.config.options, query]);

  const canCreate =
    query.trim().length > 0 && !findOptionByLabel(column.config.options, query);

  function toggle(optionId: string) {
    if (!column.config.isMulti) {
      onCommit({ kind: "select", optionIds: [optionId] });
      return;
    }

    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    );
  }

  async function create() {
    setIsCreating(true);
    try {
      const option = await onCreateOption(query.trim());
      if (!option) return;

      onCommit({
        kind: "select",
        optionIds: column.config.isMulti ? [...selected, option.id] : [option.id],
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <EditorSurface className="w-64">
      <div className="border-b border-border p-1.5">
        <Input
          ref={inputRef}
          value={query}
          placeholder="Search or create…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const first = matches[0];
              if (first) toggle(first.id);
              else if (canCreate) void create();
            }
          }}
          className="h-7 text-[12px]"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label={column.name}>
        {matches.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected.includes(option.id)}
              onClick={() => toggle(option.id)}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
            >
              <SelectChip option={option} />
              {selected.includes(option.id) && <Check className="ml-auto size-3.5 text-accent" />}
            </button>
          </li>
        ))}

        {canCreate && (
          <li>
            <button
              type="button"
              disabled={isCreating}
              onClick={() => void create()}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] text-accent hover:bg-hover"
            >
              <Plus className="size-3.5" />
              Create “{query.trim()}”
            </button>
          </li>
        )}
      </ul>

      {column.config.isMulti && (
        <div className="flex justify-end gap-1 border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => onCommit({ kind: "select", optionIds: selected })}
            className="rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      )}
    </EditorSurface>
  );
}
