"use client";

import { useState } from "react";
import { CellShell, EditorSurface, UnparsedBadge } from "@/components/board/cells/cell-frame";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { dayKeyOf, todayKey, withDayKey, type DayKey } from "@/lib/calendar";
import { formatDateTime } from "@/lib/cell-values";
import { formatDate } from "@/lib/format";
import type { BoardColumnOf, CellValue } from "@/types";

type DateValue = Extract<CellValue, { kind: "date" }>;

export function DateCellView({
  value,
  column,
}: {
  value: DateValue;
  column: BoardColumnOf<"date">;
}) {
  return (
    <CellShell>
      {value.iso ? (
        <span className="metric truncate text-ui text-muted-foreground">
          {column.config.includesTime ? formatDateTime(value.iso) : formatDate(value.iso)}
        </span>
      ) : value.text ? (
        <UnparsedBadge text={value.text} />
      ) : null}
    </CellShell>
  );
}

interface DateEditorProps {
  readonly value: DateValue;
  readonly column: BoardColumnOf<"date">;
  readonly onCommit: (value: CellValue) => void;
  readonly onCancel: () => void;
}

export function DateCellEditor({ value, column, onCommit, onCancel }: DateEditorProps) {
  const includesTime = column.config.includesTime;
  const stored = dayKeyOf(value.iso);

  const [draft, setDraft] = useState<{ day: DayKey | null; time: string }>(() => ({
    day: stored,
    time: timeOf(value.iso),
  }));

  const selected = includesTime ? draft.day : stored;

  function commit(day: DayKey | null, time: string) {
    if (day === null) {
      onCommit({ kind: "date", iso: null });
      return;
    }

    onCommit({
      kind: "date",
      iso: includesTime ? `${day}T${time || "00:00"}:00.000Z` : withDayKey(value.iso, day),
    });
  }

  return (
    <EditorSurface className="p-2" onDismiss={onCancel}>
      <Calendar
        value={selected}
        today={todayKey()}
        autoFocus
        onSelect={(day) => {
          if (!includesTime) {
            commit(day, draft.time);
            return;
          }
          setDraft((current) => ({ ...current, day }));
        }}
        footer={
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            {includesTime ? (
              <Input
                type="time"
                size="xs"
                value={draft.time}
                aria-label={`${column.name} time`}
                className="metric w-24"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, time: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && draft.day) {
                    event.preventDefault();
                    commit(draft.day, draft.time);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onCancel();
                  }
                }}
              />
            ) : (
              <span className="text-body text-faint-foreground">
                {value.text ? `Was “${value.text}”` : ""}
              </span>
            )}

            <span className="flex items-center gap-1">
              <Button
                size="xs"
                variant="ghost"
                disabled={selected === null && !value.text}
                onClick={() => commit(null, draft.time)}
              >
                Clear
              </Button>

              {includesTime && (
                <Button
                  size="xs"
                  variant="default"
                  disabled={draft.day === null}
                  onClick={() => commit(draft.day, draft.time)}
                >
                  Save
                </Button>
              )}
            </span>
          </div>
        }
      />
    </EditorSurface>
  );
}

function timeOf(iso: string | null): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "" : new Date(at).toISOString().slice(11, 16);
}
