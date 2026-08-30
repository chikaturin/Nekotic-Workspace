"use client";

import { Check, Lock, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CellOverflowCount,
  CellShell,
  EditorSurface,
  UnparsedBadge,
} from "@/components/board/cells/cell-frame";
import { Input } from "@/components/ui/input";
import { findOptionByLabel, SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { splitForCell } from "@/lib/cell-overflow";
import type { CellContext } from "@/lib/cell-values";
import {
  resolveOptionAvailability,
  unavailableBehaviorOf,
  visibleOptions,
  type OptionAvailability,
} from "@/lib/select-availability";
import { selectRow, useBoardStore } from "@/store/board-store";
import { cn } from "@/lib/utils";
import type { BoardColumn, BoardColumnOf, CellValue, SelectOption } from "@/types";

type SelectValue = Extract<CellValue, { kind: "select" }>;

export function SelectChip({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-body font-medium",
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

  const { shown, overflow } = splitForCell(chips);

  return (
    <CellShell>
      {chips.length > 0 ? (
        <>
          {shown.map((option) => (
            <SelectChip key={option.id} option={option} />
          ))}
          {overflow > 0 && (
            <CellOverflowCount
              count={overflow}
              title={chips.map((option) => option.label).join(", ")}
            />
          )}
        </>
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface SelectEditorProps {
  readonly value: SelectValue;
  readonly column: BoardColumnOf<"select">;
  readonly rowId: string;
  readonly columns: readonly BoardColumn[];
  readonly context: CellContext;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
  readonly onCreateOption: (label: string) => Promise<SelectOption | null>;
}

export function SelectCellEditor({
  value,
  column,
  rowId,
  columns,
  context,
  onCommit,
  onCancel,
  onCreateOption,
}: SelectEditorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>(value.optionIds);
  const [isCreating, setIsCreating] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const row = useBoardStore(selectRow(rowId));

  useEffect(() => inputRef.current?.focus(), []);

  const behavior = unavailableBehaviorOf(column);

  const entries = useMemo(
    () =>
      visibleOptions(
        resolveOptionAvailability({ column, row: row ?? null, columns, context }),
        behavior,
      ),
    [column, row, columns, context, behavior],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => entry.option.label.toLowerCase().includes(needle));
  }, [entries, query]);

  const canCreate = query.trim().length > 0 && !findOptionByLabel(column.config.options, query);

  function toggle(entry: OptionAvailability) {
    if (!entry.isAvailable) {
      setBlocked(entry.option.id);
      return;
    }

    setBlocked(null);

    if (!column.config.isMulti) {
      onCommit({ kind: "select", optionIds: [entry.option.id] });
      return;
    }

    setSelected((current) =>
      current.includes(entry.option.id)
        ? current.filter((id) => id !== entry.option.id)
        : [...current, entry.option.id],
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
    <EditorSurface className="w-72">
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
              const first = matches.find((entry) => entry.isAvailable) ?? matches[0];
              if (first) toggle(first);
              else if (canCreate) void create();
            }
          }}
          className="h-7 text-ui"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label={column.name}>
        {matches.map((entry) => {
          const { option, isAvailable, explanation } = entry;
          const isBlocked = blocked === option.id;

          return (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected.includes(option.id)}
                aria-disabled={!isAvailable}
                title={isAvailable ? undefined : explanation}
                onClick={() => toggle(entry)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover",
                  !isAvailable && "cursor-not-allowed is-disabled hover:bg-transparent",
                )}
              >
                <SelectChip option={option} />
                {!isAvailable && <Lock className="size-3 shrink-0 text-faint-foreground" />}
                {selected.includes(option.id) && <Check className="ml-auto size-3.5 text-accent" />}
              </button>

              {!isAvailable && (
                <p
                  className={cn(
                    "px-1.5 pb-1 text-micro",
                    isBlocked ? "text-danger" : "text-faint-foreground",
                  )}
                >
                  {explanation}
                </p>
              )}
            </li>
          );
        })}

        {matches.length === 0 && !canCreate && (
          <li className="px-1.5 py-2 text-body text-faint-foreground">
            {behavior === "hidden"
              ? "No option is available for this record right now."
              : "No match."}
          </li>
        )}

        {canCreate && (
          <li>
            <button
              type="button"
              disabled={isCreating}
              onClick={() => void create()}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-ui text-accent hover:bg-hover"
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
            className="rounded bg-accent px-2 py-1 text-body font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      )}
    </EditorSurface>
  );
}
