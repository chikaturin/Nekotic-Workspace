"use client";

import { Check, UserX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CellOverflowCount,
  CellShell,
  EditorSurface,
  UnparsedBadge,
} from "@/components/board/cells/cell-frame";
import { UserAvatar } from "@/components/shared/user-avatar";
import { splitForCell } from "@/lib/cell-overflow";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { BoardColumnOf, CellValue, DirectoryUser } from "@/types";

type UserValue = Extract<CellValue, { kind: "user" }>;

/**
 * People who left the workspace keep their name and gain an `Inactive` tag —
 * the PRD is explicit that a removed member must not blank out the cell.
 */
export function UserChip({ person }: { person: DirectoryUser }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar user={person} className={cn("size-5", !person.isActive && "opacity-50")} />
      <span
        className={cn(
          "min-w-0 truncate text-ui",
          person.isActive ? "text-foreground" : "text-faint-foreground line-through",
        )}
      >
        {person.name}
      </span>
      {!person.isActive && (
        <span className="shrink-0 rounded border border-border px-1 text-micro uppercase tracking-wide text-faint-foreground">
          inactive
        </span>
      )}
    </span>
  );
}

export function UserCellView({
  value,
  people,
}: {
  value: UserValue;
  people: ReadonlyMap<string, DirectoryUser>;
}) {
  const chips = value.userIds
    .map((id) => people.get(id))
    .filter((person): person is DirectoryUser => Boolean(person));

  const unknown = value.userIds.filter((id) => !people.has(id));
  const { shown, overflow } = splitForCell(chips);

  return (
    <CellShell>
      {shown.map((person) => (
        <UserChip key={person.id} person={person} />
      ))}
      {overflow > 0 && (
        <CellOverflowCount
          count={overflow}
          title={chips.map((person) => person.name).join(", ")}
        />
      )}
      {unknown.length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 text-body text-faint-foreground">
          <UserX className="size-3" />
          {unknown.length} unknown
        </span>
      )}
      {chips.length === 0 && unknown.length === 0 && value.text && <UnparsedBadge text={value.text} />}
    </CellShell>
  );
}

interface UserEditorProps {
  readonly value: UserValue;
  readonly column: BoardColumnOf<"user">;
  readonly people: readonly DirectoryUser[];
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

export function UserCellEditor({ value, column, people, onCommit, onCancel }: UserEditorProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>(value.userIds);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? people.filter(
          (person) =>
            person.name.toLowerCase().includes(needle) ||
            person.email.toLowerCase().includes(needle),
        )
      : people;

    // Active members first; former members stay reachable but sink.
    return [...pool].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [people, query]);

  function toggle(userId: string) {
    if (!column.config.isMulti) {
      onCommit({ kind: "user", userIds: [userId] });
      return;
    }

    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  return (
    <EditorSurface className="w-64">
      <div className="border-b border-border p-1.5">
        <Input
          ref={inputRef}
          value={query}
          placeholder="Search people…"
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
            }
          }}
          className="h-7 text-ui"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label={column.name}>
        <li>
          <button
            type="button"
            onClick={() => onCommit({ kind: "user", userIds: [] })}
            className="w-full rounded px-1.5 py-1 text-left text-ui text-faint-foreground hover:bg-hover"
          >
            Unassigned
          </button>
        </li>

        {matches.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected.includes(person.id)}
              onClick={() => toggle(person.id)}
              className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
            >
              <UserChip person={person} />
              {selected.includes(person.id) && <Check className="ml-auto size-3.5 text-accent" />}
            </button>
          </li>
        ))}
      </ul>

      {column.config.isMulti && (
        <div className="flex justify-end border-t border-border p-1.5">
          <button
            type="button"
            onClick={() => onCommit({ kind: "user", userIds: selected })}
            className="rounded bg-accent px-2 py-1 text-body font-medium text-accent-foreground"
          >
            Apply
          </button>
        </div>
      )}
    </EditorSurface>
  );
}
