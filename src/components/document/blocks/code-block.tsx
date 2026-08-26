"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CodeBlock as CodeBlockModel, CodeLanguage } from "@/types";

const LANGUAGES: readonly CodeLanguage[] = [
  "plaintext",
  "typescript",
  "javascript",
  "json",
  "sql",
  "bash",
  "python",
  "go",
];

const INDENT = "  ";
const COPY_FEEDBACK_MS = 1600;

interface CodeBlockProps {
  readonly block: CodeBlockModel;
  readonly onChange: (code: string) => void;
  readonly onLanguageChange: (language: CodeLanguage) => void;
  readonly onExit: (direction: -1 | 1) => void;
  readonly isEditable: boolean;
}

/**
 * Plain monospaced editor. Tab inserts spaces instead of leaving the block, and
 * ⌘↑/⌘↓ hop out to the neighbouring blocks so the keyboard is never trapped.
 */
export function CodeBlock({
  block,
  onChange,
  onLanguageChange,
  onExit,
  isEditable,
}: CodeBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [block.code]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Tab always leaves the block, and a read-only block never swallows
    // Tab — otherwise a locked page becomes a keyboard trap.
    if (event.key === "Tab" && isEditable && !event.shiftKey) {
      event.preventDefault();

      const element = event.currentTarget;
      const { selectionStart, selectionEnd, value } = element;
      const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
      onChange(next);
      requestAnimationFrame(() => {
        element.selectionStart = selectionStart + INDENT.length;
        element.selectionEnd = selectionStart + INDENT.length;
      });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "ArrowUp") {
      event.preventDefault();
      onExit(-1);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "ArrowDown") {
      event.preventDefault();
      onExit(1);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(block.code);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-hairline px-2 py-1.5">
        <select
          value={block.language}
          disabled={!isEditable}
          onChange={(event) => onLanguageChange(event.target.value as CodeLanguage)}
          aria-label="Code language"
          className={cn(
            "metric h-6 rounded border border-transparent bg-transparent px-1 text-[11px] text-muted-foreground outline-none",
            "hover:border-border focus-visible:border-accent disabled:cursor-default",
          )}
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>

        <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={copy} aria-label="Copy code">
          {isCopied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>

      <textarea
        ref={textareaRef}
        value={block.code}
        readOnly={!isEditable}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Code"
        placeholder="Write code…"
        title={isEditable ? "Tab indents · Shift+Tab leaves the block" : undefined}
        className="metric block max-h-[520px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-faint-foreground"
        rows={Math.max(block.code.split("\n").length, 2)}
      />
    </div>
  );
}
