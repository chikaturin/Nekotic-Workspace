"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { SelectField } from "@/components/ui/select-field";
import { isoOfDayKey } from "@/lib/calendar";
import { resolveOptionAvailability } from "@/lib/select-availability";
import type { BoardColumn, CellValue, DirectoryUser } from "@/types";

interface SubtaskComposerProps {
  readonly columns: readonly BoardColumn[];
  readonly primaryColumnId: string;
  readonly people: readonly DirectoryUser[];
  readonly onCreate: (values: Readonly<Record<string, CellValue>>) => Promise<void>;
  readonly onCancel: () => void;
}

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

  const statusOptions = statusColumn
    ? resolveOptionAvailability({
        column: statusColumn,
        row: null,
        columns,
        context: {},
        ignoreTransitions: true,
      }).filter((entry) => entry.isAvailable)
    : [];

  const assigneeOptions: readonly ListboxOption[] = people.map((person) => ({
    value: person.id,
    label: person.isActive ? person.name : `${person.name} (inactive)`,
    avatarUrl: person.avatarUrl ?? "",
  }));

  async function submit() {
    const trimmed = title.trim();
    if (trimmed.length === 0 || isSaving) return;

    const values: Record<string, CellValue> = {
      [primaryColumnId]: { kind: "text", value: trimmed },
    };

    if (statusColumn && optionId) values[statusColumn.id] = { kind: "select", optionIds: [optionId] };
    if (userColumn && assigneeId) values[userColumn.id] = { kind: "user", userIds: [assigneeId] };
    if (dateColumn && due) values[dateColumn.id] = { kind: "date", iso: isoOfDayKey(due) };

    setIsSaving(true);
    try {
      await onCreate(values);
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
          size="sm"
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
          className="flex-1"
        />
        <IconButton variant="ghost" aria-label="Cancel adding a subtask" onClick={onCancel}>
          <X />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {statusColumn && (
          <SelectField
            size="sm"
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
          <Select
            size="sm"
            aria-label={userColumn.name}
            options={assigneeOptions}
            value={assigneeId === "" ? null : assigneeId}
            onValueChange={(next) => setAssigneeId(next ?? "")}
            placeholder={`${userColumn.name}…`}
            isClearable
            className="min-w-0 flex-1"
          />
        )}

        {dateColumn && (
          <DatePicker
            size="sm"
            aria-label={dateColumn.name}
            placeholder={`${dateColumn.name}…`}
            value={due === "" ? null : due}
            onChange={(day) => setDue(day ?? "")}
            clearable
            className="min-w-0 flex-1"
          />
        )}

        <Button
          size="sm"
          variant="default"
          disabled={title.trim().length === 0 || isSaving}
          onClick={() => void submit()}
        >
          <Plus />
          Add
        </Button>
      </div>
    </div>
  );
}
