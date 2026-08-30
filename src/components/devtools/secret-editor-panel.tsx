"use client";

import { Eye, Loader2, Plus, TriangleAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { SecretEnvPaste } from "@/components/devtools/secret-env-paste";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useEnvironments } from "@/hooks/use-environments";
import type { SecretEditor } from "@/hooks/use-secret-editor";
import { isConventionalSecretKey, isValidSecretKey } from "@/lib/env-file";
import { cn } from "@/lib/utils";

interface SecretEditorPanelProps {
  readonly editor: SecretEditor;
  readonly canReveal: boolean;
  readonly onReveal: (secretId: string) => Promise<string | null>;
}

const UNCHANGED_PLACEHOLDER = "•••••••••••• unchanged";

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

              <SecretEnvironment
                optionId={row.environmentOptionId}
                onChange={(next) => editor.setEnvironment(row.localId, next)}
              />

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

/**
 * Môi trường của một hàng secret.
 *
 * Server bắt buộc phải biết secret mới thuộc môi trường nào. Hàng mới thừa
 * hưởng môi trường của hàng ngay trên nó — gần như luôn đúng khi dán một tệp
 * `.env` — nhưng vẫn phải đổi được, nếu không thì thêm một secret Production
 * vào giữa danh sách Development là không có đường.
 */
function SecretEnvironment({
  optionId,
  onChange,
}: {
  readonly optionId: string;
  readonly onChange: (optionId: string) => void;
}) {
  const environments = useEnvironments();

  return (
    <Select
      value={optionId}
      options={environments.options}
      aria-label="Environment"
      size="sm"
      className="w-36"
      isDisabled={environments.isLoading}
      onValueChange={(next) => next && onChange(next)}
    />
  );
}
