"use client";

import { Eye, Loader2, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { SecretEnvPaste } from "@/components/devtools/secret-env-paste";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SecretEditor } from "@/hooks/use-secret-editor";
import { isConventionalSecretKey, isValidSecretKey } from "@/lib/env-file";
import { cn } from "@/lib/utils";

interface SecretEditorPanelProps {
  readonly editor: SecretEditor;
  /** Whether this person may pull a stored value back into the field. */
  readonly canReveal: boolean;
  readonly onReveal: (secretId: string) => Promise<string | null>;
}

/** What an untouched row shows instead of a value it has never held. */
const UNCHANGED_PLACEHOLDER = "•••••••••••• unchanged";

/**
 * Editing a secret document.
 *
 * Structured rows, not a text area: a secret document is a list of named
 * values with an audit trail per name, and editing it as raw text would throw
 * that structure away on every save — every key would look rotated because
 * every key was rewritten.
 *
 * A row whose value has not been touched shows "unchanged" and holds nothing.
 * That is what lets somebody rename a key, delete a neighbour or reorder the
 * list without a single production credential being fetched into the browser.
 * Pulling one back is a deliberate, audited act, on one row at a time.
 */
export function SecretEditorPanel({ editor, canReveal, onReveal }: SecretEditorPanelProps) {
  const [revealingId, setRevealingId] = useState<string | null>(null);

  async function pull(localId: string, secretId: string) {
    setRevealingId(localId);
    try {
      const value = await onReveal(secretId);
      if (value !== null) editor.setValue(localId, value);
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {editor.rows.map((row) => {
          const key = row.key.trim();
          const isDuplicate = editor.duplicates.includes(key);
          const isInvalid = !isValidSecretKey(row.key);
          const isOdd = key.length > 0 && !isInvalid && !isConventionalSecretKey(key);

          return (
            <li
              key={row.localId}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2",
                isDuplicate || isInvalid ? "border-danger/50" : "border-border",
              )}
            >
              <Input
                value={row.key}
                aria-label="Secret name"
                placeholder="SECRET_NAME"
                spellCheck={false}
                aria-invalid={isDuplicate || isInvalid}
                className="metric w-56 text-ui"
                onChange={(event) => editor.setKey(row.localId, event.target.value)}
              />

              {/* `type="password"` rather than a masked string: the browser
                  keeps it out of autofill previews and off screen shares, and
                  the field still behaves like a field. */}
              <Input
                type="password"
                value={row.value ?? ""}
                aria-label={`Value for ${key || "the new secret"}`}
                placeholder={row.id && row.value === null ? UNCHANGED_PLACEHOLDER : "New value"}
                autoComplete="off"
                spellCheck={false}
                className="metric min-w-0 flex-1 text-ui"
                onChange={(event) => editor.setValue(row.localId, event.target.value)}
              />

              {row.id && canReveal && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={revealingId === row.localId}
                  aria-label={`Load the stored value of ${key || "this secret"} into the field`}
                  title="Load the stored value so it can be edited. This is recorded."
                  onClick={() => void pull(row.localId, row.id!)}
                >
                  {revealingId === row.localId ? <Loader2 className="animate-spin" /> : <Eye />}
                </Button>
              )}

              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${key || "this secret"}`}
                onClick={() => editor.remove(row.localId)}
              >
                <Trash2 />
              </Button>

              {(isDuplicate || isInvalid || isOdd) && (
                <p
                  className={cn(
                    "w-full text-body",
                    isDuplicate || isInvalid ? "text-danger" : "text-warning",
                  )}
                >
                  {isInvalid
                    ? "A name cannot be empty or contain spaces, quotes or an equals sign."
                    : isDuplicate
                      ? `“${key}” is used by more than one row. Every secret needs its own name.`
                      : `“${key}” will work, but it does not read like an environment variable.`}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {editor.rows.length === 0 && (
        <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-6 text-ui text-faint-foreground">
          <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          This document has no secrets. Add one, or paste an .env file below.
        </p>
      )}

      <Button size="sm" variant="outline" className="gap-1.5" onClick={editor.add}>
        <Plus />
        Add secret
      </Button>

      <SecretEnvPaste onApply={editor.applyEnv} />
    </div>
  );
}
