import { describe, expect, test } from "vitest";
import { matchesHotkey, parseHotkey } from "@/hooks/use-hotkey";

/**
 * The chord half of `useHotkey`, which is where the decision lives.
 *
 * It is a pure function precisely so it can be tested against the events that
 * actually arrive rather than the ones the spec describes: the listener sits on
 * `window`, and anything on the page — a browser extension, a password manager
 * — can dispatch a "keydown" that is not a `KeyboardEvent` at all.
 */

const modK = parseHotkey("mod+k");
const escape = parseHotkey("escape");

describe("reading a combo", () => {
  test("takes the last segment as the key and the rest as modifiers", () => {
    expect(parseHotkey("mod+shift+p")).toEqual({
      key: "p",
      needsMod: true,
      needsShift: true,
      needsAlt: false,
    });
  });

  test("a bare key needs no modifier held", () => {
    expect(escape).toEqual({
      key: "escape",
      needsMod: false,
      needsShift: false,
      needsAlt: false,
    });
  });
});

describe("matching a keystroke", () => {
  test("fires on the key with its modifier", () => {
    expect(matchesHotkey(modK, { key: "k", metaKey: true })).toBe(true);
    expect(matchesHotkey(modK, { key: "k", ctrlKey: true })).toBe(true);
  });

  test("is case-insensitive about the key itself", () => {
    expect(matchesHotkey(escape, { key: "Escape" })).toBe(true);
  });

  test("does not fire on the key without its modifier", () => {
    expect(matchesHotkey(modK, { key: "k" })).toBe(false);
  });

  test("does not fire when an extra modifier is held", () => {
    expect(matchesHotkey(modK, { key: "k", metaKey: true, shiftKey: true })).toBe(false);
    expect(matchesHotkey(escape, { key: "Escape", altKey: true })).toBe(false);
  });
});

describe("a keydown that carries no key", () => {
  /**
   * The page crash this guard exists for. A listener on `window` that throws
   * aborts the dispatch for every listener behind it, so one synthetic event
   * from outside the app took down the whole screen — from inside a dialog
   * that has nothing to do with shortcuts.
   */
  test("is not a shortcut, rather than an exception", () => {
    expect(() => matchesHotkey(modK, {})).not.toThrow();

    expect(matchesHotkey(modK, {})).toBe(false);
    expect(matchesHotkey(modK, { key: null, metaKey: true })).toBe(false);
    expect(matchesHotkey(modK, { key: "", metaKey: true })).toBe(false);
  });

  test("holds even for a combo with no modifiers to disagree about", () => {
    expect(matchesHotkey(escape, {})).toBe(false);
  });
});
