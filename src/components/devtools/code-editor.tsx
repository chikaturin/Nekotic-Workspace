"use client";

import { useCallback, useRef, type KeyboardEvent, type UIEvent } from "react";
import { TOKEN_CLASSES, tokenize } from "@/lib/syntax";
import { cn } from "@/lib/utils";
import type { ConfigFormat } from "@/types";

interface CodeEditorProps {
  readonly value: string;
  readonly format: ConfigFormat;
  readonly onChange: (value: string) => void;
  readonly readOnly?: boolean;
  /** 1-based line to underline, from the JSON linter. */
  readonly errorLine?: number | null;
  readonly ariaLabel: string;
}

const INDENT = "  ";
const GUTTER = "3rem";

/**
 * Syntax-highlighted editor.
 *
 * A transparent textarea sits exactly on top of a coloured `<pre>`: the user
 * types into the textarea and reads the pre. Both share the same font metrics
 * and padding, and the textarea drives the scroll position of the other two
 * layers, so the caret never drifts from the text under it.
 *
 * The type metrics on the three layers are load-bearing rather than stylistic —
 * change one and the caret walks out of the glyphs — which is why they are
 * arbitrary values here and exempted from the design system's type scale by
 * name in the lint config.
 *
 * There is no find widget, and it needs none: the coloured `<pre>` is real
 * text in the document, so the browser's own find highlights matches in it.
 * The surface takes its colours from `--syntax-*`, which is a full palette in
 * both themes — the editor follows the workspace rather than pinning itself
 * dark.
 */
export function CodeEditor({
  value,
  format,
  onChange,
  readOnly = false,
  errorLine = null,
  ariaLabel,
}: CodeEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = tokenize(value, format);

  const syncScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;

    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const target = event.currentTarget;
    const { selectionStart, selectionEnd } = target;

    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
    onChange(next);

    requestAnimationFrame(() => {
      target.selectionStart = selectionStart + INDENT.length;
      target.selectionEnd = selectionStart + INDENT.length;
    });
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-syntax-surface">
      <div
        ref={gutterRef}
        aria-hidden
        style={{ width: GUTTER }}
        className="metric absolute inset-y-0 left-0 overflow-hidden border-r border-hairline bg-canvas py-4 text-right text-[12.5px] leading-[1.6] text-faint-foreground"
      >
        {lines.map((_, index) => (
          <div
            key={index}
            className={cn("pr-2", errorLine === index + 1 && "bg-danger/15 text-danger")}
          >
            {index + 1}
          </div>
        ))}
      </div>

      <pre
        ref={preRef}
        aria-hidden
        style={{ paddingLeft: `calc(${GUTTER} + 0.75rem)` }}
        className="metric pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-4 pr-4 text-[12.5px] leading-[1.6] text-syntax-foreground"
      >
        {lines.map((tokens, index) => (
          <div
            key={index}
            className={cn(
              errorLine === index + 1 &&
                "bg-danger/10 underline decoration-danger decoration-wavy underline-offset-4",
            )}
          >
            {tokens.length === 0 ? (
              " "
            ) : (
              tokens.map((token, position) => (
                <span key={position} className={TOKEN_CLASSES[token.kind]}>
                  {token.text}
                </span>
              ))
            )}
          </div>
        ))}
      </pre>

      <textarea
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        style={{ paddingLeft: `calc(${GUTTER} + 0.75rem)` }}
        className={cn(
          "metric absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-4 pr-4",
          "text-[12.5px] leading-[1.6] text-transparent caret-syntax-foreground outline-none",
          "selection:bg-selection",
        )}
      />
    </div>
  );
}
