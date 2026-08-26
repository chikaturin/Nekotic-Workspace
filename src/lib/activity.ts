import { MOCK_NOW } from "@/config/app";
import { dayKey } from "@/lib/board-dates";
import { formatClockTime, formatDate } from "@/lib/format";
import type { ActivityEntry, FieldChange } from "@/types";

/**
 * Rendering a record's history (SY-ACT-40).
 *
 * The service records *what changed* — column, before, after — already rendered
 * to the text the column displays. This module only arranges it. Nothing here
 * ever reaches for a payload, because there is no payload to reach for: the
 * user is never shown a serialised audit blob.
 */

/** Shown in place of a value that was, or became, empty. */
export const EMPTY_VALUE_LABEL = "—";


export const displayValue = (value: string): string =>
  value.trim().length > 0 ? value.trim() : EMPTY_VALUE_LABEL;

/** `Doing → Done` — one field's before and after, ready to read aloud. */
export function changeText(change: FieldChange): string {
  return `${displayValue(change.from)} → ${displayValue(change.to)}`;
}

/** One-line summary of an entry, for tooltips and screen readers. */
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

/**
 * Group the stream into days, newest first, so a timeline reads as
 * `Today · 16:20 · Thanh changed Status` rather than repeating the date on
 * every line.
 */
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

/** `16:20` — the timestamp column of the timeline. */
export const activityTime = (iso: string): string => formatClockTime(iso);
