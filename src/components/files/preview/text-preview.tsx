"use client";

import { Check, Copy, Pencil, WrapText, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { SaveIndicator } from "@/components/document/save-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFileEditor } from "@/hooks/use-file-editor";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types";

interface TextPreviewProps {
  readonly content: string;
  readonly language: string;
  readonly node: FileNode;
  readonly canEdit: boolean;
  /** Refresh the preview once new bytes are stored. */
  readonly onSaved: () => void;
}

const COPY_FEEDBACK_MS = 1600;

/**
 * Text, CSV and source files render here — read-only by default, editable in
 * place for anyone with edit rights. Saving goes through the file service, so
 * the new bytes are what every other surface reads back.
 */
export function TextPreview({ content, language, node, canEdit, onSaved }: TextPreviewProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isWrapped, setIsWrapped] = useState(true);
  const editor = useFileEditor(node, content);

  const shown = editor.isEditing ? editor.draft : content;
  const lines = shown.split("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard permission denied — leave the button in its default state.
      setIsCopied(false);
    }
  }

  async function commit() {
    if (await editor.save(editor.draft)) onSaved();
  }

  function handleShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void commit();
      return;
    }
    if (event.key === "Escape" && !editor.isDirty) editor.discard();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface/80 px-4 py-2 backdrop-blur">
        {language && <Badge variant="default">{language}</Badge>}
        <span className="metric text-[10px] text-faint-foreground">{lines.length} lines</span>

        {editor.isEditing && (
          <SaveIndicator state={editor.saveState} onRetry={() => void commit()} />
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={isWrapped ? "subtle" : "ghost"}
            aria-pressed={isWrapped}
            onClick={() => setIsWrapped((wrapped) => !wrapped)}
            className="gap-1.5"
          >
            <WrapText />
            Wrap
          </Button>

          <Button size="sm" variant="ghost" onClick={copy} className="gap-1.5">
            {isCopied ? <Check className="text-success" /> : <Copy />}
            {isCopied ? "Copied" : "Copy"}
          </Button>

          {canEdit && !editor.isEditing && (
            <Button size="sm" variant="outline" onClick={editor.start} className="gap-1.5">
              <Pencil />
              Edit
            </Button>
          )}

          {editor.isEditing && (
            <>
              <Button size="sm" variant="ghost" onClick={editor.discard} className="gap-1.5">
                <X />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!editor.isDirty || editor.saveState.status === "saving"}
                onClick={() => void commit()}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {editor.isEditing ? (
          <textarea
            value={editor.draft}
            onChange={(event) => editor.change(event.target.value)}
            onKeyDown={handleShortcut}
            spellCheck={false}
            autoFocus
            aria-label={`Edit ${node.name}`}
            className={cn(
              "metric h-full min-h-full w-full resize-none bg-transparent p-4 text-[12.5px]",
              "leading-relaxed text-foreground outline-none",
              isWrapped ? "whitespace-pre-wrap" : "whitespace-pre",
            )}
          />
        ) : (
          <pre className="metric grid grid-cols-[auto_1fr] gap-x-4 p-4 text-[12.5px] leading-relaxed">
            {lines.map((line, index) => (
              <span key={index} className="contents">
                <span className="select-none text-right text-faint-foreground">{index + 1}</span>
                <span
                  className={cn(
                    "text-muted-foreground",
                    isWrapped ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                  )}
                >
                  {line || " "}
                </span>
              </span>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
