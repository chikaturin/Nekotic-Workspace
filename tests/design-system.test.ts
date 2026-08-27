import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { stepIndex } from "@/hooks/use-roving-focus";
import { cn } from "@/lib/utils";

/**
 * The design system's two load-bearing pieces of logic.
 *
 * Neither is a component, and that is the point: components can be eyeballed
 * on the gallery page, but a class merger that silently drops a token and a
 * keyboard traversal that skips the wrong item both fail invisibly.
 */

/* ------------------------------------------------------------------- cn() */

/**
 * `cn` is a bare `twMerge` until it is told about the theme's own scales, and
 * its guess for an unknown `text-*` class is *text colour*. That guess is
 * destructive rather than merely wrong: pairing a size with a colour dropped
 * one of the two, with no error and no warning, everywhere in the app.
 */
describe("class merging knows the workspace scales", () => {
  test("a type token and a colour token are two independent decisions", () => {
    expect(cn("text-foreground", "text-ui")).toBe("text-foreground text-ui");
    expect(cn("text-ui", "text-foreground")).toBe("text-ui text-foreground");
    expect(cn("text-body text-danger")).toBe("text-body text-danger");
    expect(cn("text-micro", "text-accent")).toBe("text-micro text-accent");
  });

  test("two type tokens still conflict, and the later one wins", () => {
    expect(cn("text-body", "text-lead")).toBe("text-lead");
    expect(cn("text-title", "text-micro")).toBe("text-micro");
  });

  /** A caller override has to beat the variant, or `className` is decorative. */
  test("an arbitrary size still beats a token, so an escape hatch stays open", () => {
    expect(cn("text-ui", "text-[13.5px]")).toBe("text-[13.5px]");
  });

  test("elevation and layer tokens conflict within their own groups", () => {
    expect(cn("shadow-raise", "shadow-float")).toBe("shadow-float");
    expect(cn("z-modal", "z-tooltip")).toBe("z-tooltip");
    // …and not across them: a shadow must not cancel a layer.
    expect(cn("z-dropdown", "shadow-pop")).toBe("z-dropdown shadow-pop");
  });

  test("a named state opacity replaces a numeric one", () => {
    expect(cn("opacity-50", "is-disabled")).toBe("is-disabled");
  });

  test("the stock Tailwind ramp is untouched by the extension", () => {
    // `text-base` is deliberately NOT redefined — doing so would silently
    // reshrink every existing use from 16px to 12px.
    expect(cn("text-base", "text-lead")).toBe("text-lead");
    expect(cn("text-red-500", "text-body")).toBe("text-red-500 text-body");
  });
});

/* --------------------------------------------------------- roving traversal */

const allEnabled = () => true;

describe("arrow-key traversal", () => {
  test("moves one step in the direction asked for", () => {
    expect(stepIndex({ from: 0, delta: 1, count: 4, loop: false, isEnabled: allEnabled })).toBe(1);
    expect(stepIndex({ from: 2, delta: -1, count: 4, loop: false, isEnabled: allEnabled })).toBe(1);
  });

  test("stops at the ends when it does not loop", () => {
    expect(stepIndex({ from: 3, delta: 1, count: 4, loop: false, isEnabled: allEnabled })).toBe(3);
    expect(stepIndex({ from: 0, delta: -1, count: 4, loop: false, isEnabled: allEnabled })).toBe(0);
  });

  test("wraps when it does", () => {
    expect(stepIndex({ from: 3, delta: 1, count: 4, loop: true, isEnabled: allEnabled })).toBe(0);
    expect(stepIndex({ from: 0, delta: -1, count: 4, loop: true, isEnabled: allEnabled })).toBe(3);
  });

  /** A disabled tab is not a place the cursor can rest. */
  test("skips over a disabled entry rather than landing on it", () => {
    const isEnabled = (index: number) => index !== 1;
    expect(stepIndex({ from: 0, delta: 1, count: 4, loop: false, isEnabled })).toBe(2);
  });

  test("skips a run of them", () => {
    const isEnabled = (index: number) => index === 0 || index === 3;
    expect(stepIndex({ from: 0, delta: 1, count: 4, loop: false, isEnabled })).toBe(3);
  });

  /**
   * A group whose every item is disabled would otherwise wrap forever looking
   * for a landing spot, so the search is bounded and focus stays put.
   */
  test("gives up rather than spinning when nothing can be landed on", () => {
    const isEnabled = () => false;
    expect(stepIndex({ from: 1, delta: 1, count: 4, loop: true, isEnabled })).toBe(1);
  });

  test("an empty group has nowhere to go", () => {
    expect(stepIndex({ from: 0, delta: 1, count: 0, loop: true, isEnabled: allEnabled })).toBe(-1);
  });
});

/* -------------------------------------------------------------- the tokens */

const CSS = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

/**
 * A lint rule that names a token the stylesheet does not define is a rule that
 * sends people somewhere they cannot go. These two files have to agree.
 */
describe("token scales", () => {
  const TYPE = ["micro", "body", "ui", "lead", "title", "display", "code"];
  const LAYERS = [
    "base",
    "raised",
    "sticky",
    "overlay",
    "modal",
    "dropdown",
    "toast",
    "tooltip",
  ];

  test("every type step is defined, with a line height of its own", () => {
    for (const step of TYPE) {
      expect(CSS).toContain(`--text-${step}:`);
      expect(CSS).toContain(`--text-${step}--line-height:`);
    }
  });

  /**
   * Defining `--text-base` would redefine Tailwind's own `text-base` from 16px
   * to 12px, shrinking every existing use without anyone touching it.
   */
  test("the type scale does not collide with Tailwind's", () => {
    for (const stock of ["base", "sm", "xs", "lg", "xl"]) {
      expect(CSS).not.toContain(`--text-${stock}:`);
    }
  });

  test("every layer is defined and every step is distinct", () => {
    const values = LAYERS.map((layer) => {
      const match = new RegExp(`--z-${layer}:\\s*(\\d+)`).exec(CSS);
      expect(match, `--z-${layer} is not defined`).not.toBeNull();
      return Number(match?.[1]);
    });

    expect(new Set(values).size).toBe(values.length);
    // Strictly ascending, so the ladder can be read as an order.
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  /**
   * A menu is always opened *from* something, so it has to paint over it —
   * including over the dialog that owns it, since both portal to <body>.
   */
  test("a dropdown outranks the modal it can be opened from", () => {
    const layer = (name: string) => Number(new RegExp(`--z-${name}:\\s*(\\d+)`).exec(CSS)?.[1]);

    expect(layer("dropdown")).toBeGreaterThan(layer("modal"));
    expect(layer("toast")).toBeGreaterThan(layer("dropdown"));
    expect(layer("tooltip")).toBeGreaterThan(layer("toast"));
  });

  test("the control ladder binds a padding to every height", () => {
    for (const step of ["xs", "sm", "md", "lg"]) {
      expect(CSS).toContain(`--control-${step}:`);
      expect(CSS).toContain(`--control-pad-${step}:`);
    }
  });

  test("state opacities are named rather than numbered", () => {
    for (const state of ["disabled", "dragging", "pending", "frozen"]) {
      expect(CSS).toContain(`--${state}-opacity:`);
      expect(CSS).toContain(`.is-${state} {`);
    }
  });

  /** Stock Tailwind shadows are black, which reads as dirt on a navy theme. */
  test("elevation is theme-aware", () => {
    const dark = CSS.slice(CSS.indexOf(".dark {"));
    for (const step of ["raise", "pop", "float"]) {
      expect(CSS).toContain(`--shadow-${step}:`);
      expect(dark).toContain(`--shadow-${step}:`);
    }
  });

  test("reduced motion is honoured once, at the root", () => {
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
    // Collapsed to an instant frame rather than removed, so an `animationend`
    // listener still fires and nothing gets stuck mid-state.
    expect(CSS).toContain("animation-duration: 0.01ms !important");
  });
});

/* ------------------------------------------------------------- the frame */

const SHELL = readFileSync(
  fileURLToPath(new URL("../src/components/layout/app-shell.tsx", import.meta.url)),
  "utf8",
);

/**
 * The app is a fixed frame, and every one of these is what keeps it fixed.
 *
 * They are asserted from the source because there is nothing else to assert
 * them from: the failure is a CSS one, it shows up only in a browser, and what
 * it looks like there is the whole product sliding out of view with no
 * scrollbar left to bring it back. Each rule below is one of the ways that
 * could happen, closed.
 */
describe("nothing scrolls the frame itself", () => {
  test("the document has no scrollbar to offer in the first place", () => {
    expect(CSS).toMatch(/html,\s*\n?\s*body\s*\{[^}]*height:\s*100%/);
    expect(CSS).toMatch(/html,\s*\n?\s*body\s*\{[^}]*overflow:\s*hidden/);
  });

  /**
   * `overflow: hidden` is still a scroll container — it only hides the
   * scrollbar. A focus landing on a control that is out of view scrolls the
   * nearest one, and on a frame that is the whole app. `clip` has no
   * scrollport at all, which is the difference that matters here.
   */
  test("the frame and the main region clip rather than hide", () => {
    expect(SHELL).toContain("h-svh w-full overflow-clip");
    expect(SHELL).toContain('<main className="min-h-0 flex-1 overflow-clip">');
    expect(SHELL).not.toMatch(/className="[^"]*\boverflow-hidden\b/);
  });

  /** A list that reaches its end must not spend the rest of the gesture on
      whatever is behind it — which is how the frame moved in the first place. */
  test("scroll is contained by default, not per scroll container", () => {
    expect(CSS).toMatch(/\*\s*\{[^}]*overscroll-behavior:\s*contain/);
  });
});
