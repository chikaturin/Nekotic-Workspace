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

/**
 * The design system calendar, mounted straight into the cell.
 *
 * There is no trigger here on purpose. A cell that has been opened for editing
 * has already been clicked; putting a "Pick a date" button inside it would mean
 * a second click to reach the thing the first click asked for. The trigger form
 * — `DatePicker` — is for the places where the control sits at rest in a form.
 *
 * It is also why this is a bare `Calendar` rather than the picker: `DatePicker`
 * opens a portalled popover at `z-dropdown`, which would paint over the frozen
 * primary column. The editor surface sits *below* the frozen pane by design,
 * and `revealBeyondFrozen` scrolls the cell clear of it first.
 *
 * Choosing a day commits and closes — one click, no Apply. A column that also
 * carries a time is the one exception: the day is half the value there, so the
 * draft is held until both halves are in.
 */
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

    // Date-only keeps whatever time the value already carried — a value that
    // arrived from an import at 09:00 should not silently become midnight
    // because somebody moved it a day. With a time field on screen, that field
    // is the answer instead.
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
                  // The one field in this editor you type into, so it is the
                  // one place Enter can mean "done" without ambiguity.
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

/** `14:30` out of a stored instant, in the UTC the whole app reads dates in. */
function timeOf(iso: string | null): string {
  if (!iso) return "";
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "" : new Date(at).toISOString().slice(11, 16);
}
