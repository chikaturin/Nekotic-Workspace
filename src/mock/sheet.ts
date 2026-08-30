import type { Grid } from "@/lib/grid";

const HEADERS: readonly string[] = ["Item", "Owner", "Q3", "Q4", "Status"];
const OWNERS: readonly string[] = ["Khanh Luu", "Mai Tran", "Duc Pham", "Lan Nguyen", "Hai Vo"];
const STATUSES: readonly string[] = ["On track", "At risk", "Done", "Planned"];
const ROW_COUNT = 8;

function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return value;
}

export function mockSheet(seed: string, label: string): Grid {
  const digest = hash(seed);
  const stem = label.replace(/\.[^.]+$/, "");

  const rows = Array.from({ length: ROW_COUNT }, (_, index) => {
    const step = digest + index * 37;

    return [
      `${stem} line ${index + 1}`,
      OWNERS[step % OWNERS.length] ?? "",
      `${((step % 90) + 10) * 100}`,
      `${((step % 70) + 20) * 100}`,
      STATUSES[step % STATUSES.length] ?? "",
    ];
  });

  return [HEADERS, ...rows];
}
