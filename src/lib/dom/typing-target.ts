
interface TargetLike {
  readonly tagName?: unknown;
  readonly isContentEditable?: unknown;
  readonly closest?: (selector: string) => unknown;
}

const TYPING_TAGS: ReadonlySet<string> = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function asElement(target: unknown): TargetLike | null {
  return target !== null && typeof target === "object" ? (target as TargetLike) : null;
}

export function isTypingTarget(target: unknown): boolean {
  const element = asElement(target);
  if (!element) return false;

  if (typeof element.tagName === "string" && TYPING_TAGS.has(element.tagName)) return true;
  return element.isContentEditable === true;
}

export function isHeaderTarget(target: unknown): boolean {
  const element = asElement(target);
  if (!element || typeof element.closest !== "function") return false;

  return element.closest('[role="columnheader"]') != null;
}

export function isGridKeyTarget(target: unknown): boolean {
  return !isTypingTarget(target) && !isHeaderTarget(target);
}
