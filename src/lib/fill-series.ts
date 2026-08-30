
const MAX_SERIES_DIGITS = 15;

export type FillPattern =
  | { readonly kind: "copy" }
  | { readonly kind: "number"; readonly start: number; readonly step: number }
  | {
      readonly kind: "text-number";
      readonly prefix: string;
      readonly suffix: string;
      readonly start: number;
      readonly step: number;
      readonly padTo: number;
    }
  | { readonly kind: "date"; readonly startMs: number; readonly stepDays: number };

interface NumericPart {
  readonly prefix: string;
  readonly digits: string;
  readonly suffix: string;
}

function splitTrailingNumber(text: string): NumericPart | null {
  const match = /^(.*?)(\d+)(\D*)$/.exec(text);

  if (!match) return null;

  const [, prefix = "", digits = "", suffix = ""] = match;

  if (digits.length === 0 || digits.length > MAX_SERIES_DIGITS) return null;

  return { prefix, digits, suffix };
}

function asPlainNumber(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null;

  const value = Number(text.trim());

  return Number.isSafeInteger(value) ? value : null;
}

const MS_PER_DAY = 86_400_000;

function asDateMs(text: string): number | null {
  const trimmed = text.trim();

  if (trimmed === "") return null;

  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;

  const ms = Date.parse(trimmed);

  return Number.isNaN(ms) ? null : ms;
}

function evenStep(steps: readonly number[]): number | null {
  if (steps.length === 0) return null;

  const [first] = steps;

  if (first === undefined || first === 0) return null;

  return steps.every((step) => step === first) ? first : null;
}

function detectNumber(values: readonly string[]): FillPattern | null {
  const numbers = values.map(asPlainNumber);

  if (numbers.some((value) => value === null)) return null;

  const parsed = numbers as number[];
  const start = parsed.at(-1);

  if (start === undefined) return null;

  if (parsed.length === 1) return null;

  const step = evenStep(
    parsed.slice(1).map((value, index) => value - (parsed[index] ?? 0)),
  );

  return step === null ? null : { kind: "number", start, step };
}

function detectTextNumber(values: readonly string[]): FillPattern | null {
  const parts = values.map(splitTrailingNumber);

  if (parts.some((part) => part === null)) return null;

  const parsed = parts as NumericPart[];
  const [first] = parsed;

  if (first === undefined) return null;

  const sameShape = parsed.every(
    (part) => part.prefix === first.prefix && part.suffix === first.suffix,
  );

  if (!sameShape) return null;

  const numbers = parsed.map((part) => Number(part.digits));
  const last = parsed.at(-1);
  const start = numbers.at(-1);

  if (last === undefined || start === undefined) return null;

  const padTo = last.digits.startsWith("0") ? last.digits.length : 0;

  if (parsed.length === 1) {
    if (first.prefix === "" && first.suffix === "") return null;

    if (asDateMs(values[0] ?? "") !== null) return null;

    return {
      kind: "text-number",
      prefix: first.prefix,
      suffix: first.suffix,
      start,
      step: 1,
      padTo,
    };
  }

  const step = evenStep(
    numbers.slice(1).map((value, index) => value - (numbers[index] ?? 0)),
  );

  if (step === null) return null;

  return {
    kind: "text-number",
    prefix: first.prefix,
    suffix: first.suffix,
    start,
    step,
    padTo,
  };
}

function detectDate(values: readonly string[]): FillPattern | null {
  const stamps = values.map(asDateMs);

  if (stamps.some((value) => value === null)) return null;

  const parsed = stamps as number[];
  const startMs = parsed.at(-1);

  if (startMs === undefined) return null;

  if (parsed.length === 1) return null;

  const stepDays = evenStep(
    parsed
      .slice(1)
      .map((value, index) => Math.round((value - (parsed[index] ?? 0)) / MS_PER_DAY)),
  );

  return stepDays === null ? null : { kind: "date", startMs, stepDays };
}

export function detectFillPattern(values: readonly string[]): FillPattern {
  if (values.length === 0 || values.some((value) => value.trim() === "")) {
    return { kind: "copy" };
  }

  return (
    detectDate(values) ??
    detectNumber(values) ??
    detectTextNumber(values) ?? { kind: "copy" }
  );
}

const pad = (value: number, width: number): string =>
  value < 0
    ? `-${Math.abs(value).toString().padStart(width, "0")}`
    : value.toString().padStart(width, "0");

export function projectFillValue(
  pattern: FillPattern,
  offset: number,
): string | null {
  switch (pattern.kind) {
    case "copy":
      return null;

    case "number":
      return String(pattern.start + pattern.step * offset);

    case "text-number": {
      const next = pattern.start + pattern.step * offset;
      return `${pattern.prefix}${pad(next, pattern.padTo)}${pattern.suffix}`;
    }

    case "date": {
      const next = new Date(pattern.startMs + pattern.stepDays * offset * MS_PER_DAY);
      return next.toISOString();
    }
  }
}
