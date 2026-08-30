export function touchEntry<T>(
  entries: readonly T[],
  entry: T,
  keyOf: (entry: T) => string,
  limit: number,
): readonly T[] {
  if (limit <= 0) return [];

  const key = keyOf(entry);
  const rest = entries.filter((candidate) => keyOf(candidate) !== key);

  return [entry, ...rest].slice(0, limit);
}

export function dropEntry<T>(
  entries: readonly T[],
  key: string,
  keyOf: (entry: T) => string,
): readonly T[] {
  const next = entries.filter((candidate) => keyOf(candidate) !== key);
  return next.length === entries.length ? entries : next;
}
