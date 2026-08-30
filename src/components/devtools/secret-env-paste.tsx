"use client";

import { ClipboardPaste, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseEnv } from "@/lib/env-file";
import type { PasteMode } from "@/hooks/use-secret-editor";
import type { EnvEntry } from "@/lib/env-file";

interface SecretEnvPasteProps {
  readonly onApply: (entries: readonly EnvEntry[], mode: PasteMode) => void;
}

export function SecretEnvPaste({ onApply }: SecretEnvPasteProps) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseEnv(text), [text]);

  const hasContent = text.trim().length > 0;

  function apply(mode: PasteMode) {
    onApply(parsed.entries, mode);
    setText("");
  }

  return (
    <section className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <header className="flex items-center gap-1.5">
        <ClipboardPaste aria-hidden="true" className="size-3.5 text-faint-foreground" />
        <h3 className="text-ui font-medium text-foreground">Paste an .env file</h3>
      </header>

      <Textarea
        rows={5}
        value={text}
        spellCheck={false}
        aria-label="ENV text to parse"
        placeholder={"DATABASE_URL=postgres://localhost:5432/app\nJWT_SECRET=\"abc123\"\nPORT=6868"}
        className="metric text-ui"
        onChange={(event) => setText(event.target.value)}
      />

      {hasContent && (
        <div className="space-y-1 text-body">
          <p className="text-muted-foreground">
            {parsed.entries.length} key{parsed.entries.length === 1 ? "" : "s"} found
            {parsed.droppedComments > 0 &&
              ` · ${parsed.droppedComments} comment line${parsed.droppedComments === 1 ? "" : "s"} will be dropped`}
          </p>

          {parsed.duplicates.length > 0 && (
            <p className="flex items-start gap-1 text-warning">
              <TriangleAlert aria-hidden="true" className="mt-px size-3 shrink-0" />
              <span>
                Duplicate key{parsed.duplicates.length === 1 ? "" : "s"}:{" "}
                <span className="metric">{parsed.duplicates.join(", ")}</span>. Both are kept — fix
                the one you do not want before saving.
              </span>
            </p>
          )}

          {parsed.invalid.length > 0 && (
            <p className="flex items-start gap-1 text-faint-foreground">
              <TriangleAlert aria-hidden="true" className="mt-px size-3 shrink-0" />
              <span>
                {parsed.invalid.length} line{parsed.invalid.length === 1 ? "" : "s"} skipped —
                line {parsed.invalid.map((problem) => problem.line).join(", ")} are not KEY=value.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          disabled={parsed.entries.length === 0}
          title="Update keys that are already here and add the rest"
          onClick={() => apply("merge")}
        >
          Add &amp; update
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={parsed.entries.length === 0}
          title="Use exactly this list — anything not in the paste is removed"
          onClick={() => apply("replace")}
        >
          Replace all
        </Button>
        {hasContent && (
          <Button size="sm" variant="ghost" onClick={() => setText("")}>
            Clear
          </Button>
        )}
      </div>

      <p className="text-micro text-faint-foreground">
        Nothing is saved until you press Save. Comments and blank lines are not stored — a secret
        document holds names and values only.
      </p>
    </section>
  );
}
