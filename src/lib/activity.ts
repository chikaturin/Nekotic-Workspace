import { MOCK_NOW } from "@/config/app";
import { dayKey } from "@/lib/board-dates";
import { formatClockTime, formatDate } from "@/lib/format";
import type { ActivityEntry, FieldChange } from "@/types";

export const EMPTY_VALUE_LABEL = "—";

export const displayValue = (value: string): string =>
  value.trim().length > 0 ? value.trim() : EMPTY_VALUE_LABEL;

export function changeText(change: FieldChange): string {
  return `${displayValue(change.from)} → ${displayValue(change.to)}`;
}

export function describeActivity(entry: ActivityEntry): string {
  if (entry.changes.length === 0) return `${entry.actor.name} ${entry.summary}`;

  const details = entry.changes
    .map((change) => `${change.columnName}: ${changeText(change)}`)
    .join(", ");

  return `${entry.actor.name} ${entry.summary} — ${details}`;
}

export interface ActivityDay {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly ActivityEntry[];
}

export function groupActivityByDay(
  entries: readonly ActivityEntry[],
  reference: string = MOCK_NOW,
): readonly ActivityDay[] {
  const days = new Map<string, ActivityEntry[]>();

  for (const entry of [...entries].sort(byNewest)) {
    const key = dayKey(entry.createdAt) ?? "unknown";
    const bucket = days.get(key);

    if (bucket) bucket.push(entry);
    else days.set(key, [entry]);
  }

  return [...days.entries()].map(([key, dayEntries]) => ({
    key,
    label: dayLabel(key, reference),
    entries: dayEntries,
  }));
}

function byNewest(a: ActivityEntry, b: ActivityEntry): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function dayLabel(key: string, reference: string): string {
  const today = dayKey(reference);
  if (key === today) return "Today";

  const yesterday = dayKey(new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000).toISOString());
  if (key === yesterday) return "Yesterday";

  return formatDate(`${key}T00:00:00.000Z`);
}

export const activityTime = (iso: string): string => formatClockTime(iso);
