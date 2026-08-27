"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { resolveOptionAvailability } from "@/lib/select-availability";
import type { BoardColumn, CellValue, DirectoryUser } from "@/types";

interface SubtaskComposerProps {
  readonly columns: readonly BoardColumn[];
  readonly primaryColumnId: string;
  readonly people: readonly DirectoryUser[];
  readonly onCreate: (values: Readonly<Record<string, CellValue>>) => Promise<void>;
  readonly onCancel: () => void;
}

/**
 * Quick add: title, owner, status and a deadline in one row.
 *
 * The four fields are found by *type* rather than by name — the first select,
 * the first user column, the first date column — so the same composer works on
 * a task board, a bug board and anything a user builds themselves.
 *
 * A new subtask is a full record, so the status list is offered from the
 * column's own options with the availability rules already applied; a status a
 * rule forbids is never on the menu here either.
 */
export function SubtaskComposer({
  columns,
  primaryColumnId,
  people,
  onCreate,
  onCancel,
}: SubtaskComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [due, setDue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => inputRef.current?.focus(), []);

  const statusColumn = columns.find((column) => column.type === "select") ?? null;
  const userColumn = columns.find((column) => column.type === "user") ?? null;
  const dateColumn = columns.find((column) => column.type === "date") ?? null;

  /**
   * No record exists yet, so there is nothing to evaluate conditions against.
   * Options switched off in column settings are still filtered out — that gate
   * needs no record.
   */
  const statusOptions = statusColumn
    ? resolveOptionAvailability({
        column: statusColumn,
        row: null,
        columns,
        context: {},
        ignoreTransitions: true,
      }).filter((entry) => entry.isAvailable)
    : [];

  async function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0 || isSaving) return;

    const values: Record<string, CellValue> = {
      [primaryColumnId]: { kind: "text", value: trimmed },
    };

    if (statusColumn && optionId) values[statusColumn.id] = { kind: "select", optionIds: [optionId] };
    if (userColumn && assigneeId) values[userColumn.id] = { kind: "user", userIds: [assigneeId] };
    if (dateColumn && due) {
      values[dateColumn.id] = { kind: "date", iso: new Date(`${due}T00:00:00.000Z`).toISOString() };
    }

    setIsSaving(true);
    try {
      await onCreate(values);
      // Cleared rather than closed: adding five subtasks in a row is the flow.
      setTitle("");
      setDue("");
      inputRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-surface p-2">
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={title}
          placeholder="Subtask title"
          aria-label="Subtask title"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          className="h-7 flex-1 text-ui"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel adding a subtask"
          onClick={onCancel}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {statusColumn && (
          <SelectField
            aria-label={statusColumn.name}
            value={optionId}
            onChange={(event) => setOptionId(event.target.value)}
            className="min-w-0 flex-1"
          >
            <option value="">{statusColumn.name}…</option>
            {statusOptions.map(({ option }) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>
        )}

        {userColumn && (
          <SelectField
            aria-label={userColumn.name}
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="min-w-0 flex-1"
          >
            <option value="">{userColumn.name}…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.isActive ? person.name : `${person.name} (inactive)`}
              </option>
            ))}
          </SelectField>
        )}

        {dateColumn && (
          <Input
            type="date"
            aria-label={dateColumn.name}
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="h-7 min-w-0 flex-1 text-ui"
          />
        )}

        <Button
          size="sm"
          variant="default"
          disabled={title.trim().length === 0 || isSaving}
          onClick={() => void submit()}
          className="h-7 gap-1.5 px-2 text-body"
        >
          <Plus />
          Add
        </Button>
      </div>
    </div>
  );
}
