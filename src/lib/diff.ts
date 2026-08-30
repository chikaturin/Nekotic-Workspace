import type { DiffLine, DiffSummary } from "@/types";

const MAX_LINES = 2_000;

export function diffLines(before: readonly string[], after: readonly string[]): readonly DiffLine[] {
  if (before.length > MAX_LINES || after.length > MAX_LINES) {
    return [
      ...before.map((text): DiffLine => ({ kind: "removed", text })),
      ...after.map((text): DiffLine => ({ kind: "added", text })),
    ];
  }

  const table = lcsTable(before, after);
  const lines: DiffLine[] = [];

  let row = 0;
  let column = 0;

  while (row < before.length && column < after.length) {
    if (before[row] === after[column]) {
      lines.push({ kind: "same", text: before[row] ?? "" });
      row += 1;
      column += 1;
      continue;
    }

    if ((table[row + 1]?.[column] ?? 0) >= (table[row]?.[column + 1] ?? 0)) {
      lines.push({ kind: "removed", text: before[row] ?? "" });
      row += 1;
    } else {
      lines.push({ kind: "added", text: after[column] ?? "" });
      column += 1;
    }
  }

  while (row < before.length) {
    lines.push({ kind: "removed", text: before[row] ?? "" });
    row += 1;
  }
  while (column < after.length) {
    lines.push({ kind: "added", text: after[column] ?? "" });
    column += 1;
  }

  return lines;
}

function lcsTable(before: readonly string[], after: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );

  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      const current = table[row];
      const next = table[row + 1];
      if (!current || !next) continue;

      current[column] =
        before[row] === after[column]
          ? (next[column + 1] ?? 0) + 1
          : Math.max(next[column] ?? 0, current[column + 1] ?? 0);
    }
  }

  return table;
}

export function summarizeDiff(lines: readonly DiffLine[]): DiffSummary {
  return {
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
  };
}

export function describeDiff(summary: DiffSummary): string {
  if (summary.added === 0 && summary.removed === 0) return "no line changes";

  const parts: string[] = [];
  if (summary.added > 0) parts.push(`+${summary.added}`);
  if (summary.removed > 0) parts.push(`−${summary.removed}`);
  return `${parts.join(" ")} lines`;
}
