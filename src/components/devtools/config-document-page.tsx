"use client";

import { Braces, History, TriangleAlert, Wand2 } from "lucide-react";
import { useState } from "react";
import { CodeEditor } from "@/components/devtools/code-editor";
import { EnvironmentPicker } from "@/components/devtools/environment-picker";
import { LanguagePicker } from "@/components/devtools/language-picker";
import { ConfigVersionsDialog } from "@/components/versions/version-dialogs";
import { SaveIndicator } from "@/components/document/save-indicator";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { NodeTitleInput } from "@/components/shared/node-title-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCapabilities, usePermissions } from "@/hooks/use-permissions";
import { useConfigDocument } from "@/hooks/use-config-document";
import { useHotkey } from "@/hooks/use-hotkey";
import { canFormat, formatSource, NO_FORMATTER_HINT } from "@/lib/code-format";
import { CONFIG_FORMAT_LABELS } from "@/lib/syntax";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { ConfigFormat, DocumentNode } from "@/types";

/**
 * DV-CFG-22 — a config document, in whatever language it is actually written
 * in: syntax colour, a formatter where a real parser exists, and a version
 * history that can be restored from.
 *
 * The language is a property of the document rather than of its file name, so
 * it is picked in the header and travels with the content. Changing it recolours
 * and re-offers the formatter; it never rewrites a byte.
 */
export function ConfigDocumentPage({ node }: { node: DocumentNode }) {
  const capabilities = useCapabilities(node);
  const can = usePermissions(node);
  const canEdit = capabilities.edit;
  const controller = useConfigDocument(node.id, canEdit);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  useHotkey("mod+s", () => controller.save(), { enableInInputs: true });

  /**
   * Reformat, or say why not — and on a refusal leave the source exactly as it
   * was. A formatter that half-rewrites an unparseable file is data loss with a
   * friendly icon.
   *
   * Asynchronous because the parser for this language is fetched the first time
   * it is needed; the button reports that rather than looking dead for a beat.
   */
  async function reformat(format: ConfigFormat) {
    setIsFormatting(true);
    try {
      const result = await formatSource(controller.draft, format);
      if (result.ok) controller.setDraft(result.text);
      else pushFeedback(result.message, "error");
    } finally {
      setIsFormatting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <AsyncBoundary state={controller.state} onRetry={controller.reload} loading={<ConfigSkeleton />}>
        {(document) => (
          <>
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <span className="text-xl">{node.icon}</span>

              <div className="min-w-0 flex-1">
                {/* The name is edited here, on the surface the document is
                    open on — not only from the tree it happens to live in. */}
                <NodeTitleInput
                  node={node}
                  canRename={can("node.rename")}
                  className="w-full px-1 py-0.5"
                />
                <p className="metric truncate px-1 text-body text-faint-foreground">
                  {CONFIG_FORMAT_LABELS[document.format]} · v{document.version} ·{" "}
                  {document.updatedBy.name}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <LanguagePicker
                  value={document.format}
                  canEdit={canEdit}
                  onChange={(format) => void controller.setFormat(format)}
                />
                <EnvironmentPicker
                  optionId={document.environmentOptionId}
                  canEdit={canEdit}
                  canManage={can("document.update")}
                  onChange={(optionId) => void controller.setEnvironment(optionId)}
                />
                {!canEdit && <Badge variant="default">read only</Badge>}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <SaveIndicator
                  state={controller.saveState}
                  onRetry={controller.retry}
                  isReadOnly={!canEdit}
                />

                {/* Shown for every language, disabled where there is no real
                    parser behind it, and saying so. Hiding it instead would
                    leave the reader wondering whether they had missed a menu. */}
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={
                      !canFormat(document.format) || controller.problem !== null || isFormatting
                    }
                    title={formatHint(document.format, controller.problem !== null)}
                    onClick={() => void reformat(document.format)}
                  >
                    {isFormatting ? <Spinner /> : <Wand2 />}
                    Format
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => setIsHistoryOpen(true)}
                >
                  <History />
                  History
                </Button>

                {/* Autosave carries the edit; this is the "now, please" that
                    ⌘S also does, and the thing to reach for before closing a
                    laptop mid-sentence. */}
                <Button
                  size="sm"
                  variant="default"
                  disabled={!canEdit || !controller.isDirty || controller.saveState.status === "saving"}
                  onClick={controller.save}
                >
                  Save
                </Button>
              </div>
            </header>

            {controller.problem && (
              <div className="flex shrink-0 items-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-1.5">
                <TriangleAlert className="size-3.5 shrink-0 text-danger" />
                <span className="min-w-0 flex-1 truncate text-ui text-danger">
                  {controller.problem.message}
                </span>
                <span className="metric shrink-0 text-body text-danger/80">
                  line {controller.problem.line}, column {controller.problem.column}
                </span>
              </div>
            )}

            {document.format === "json" && !controller.problem && controller.isDirty && (
              <div className="flex shrink-0 items-center gap-2 border-b border-success/30 bg-success/10 px-4 py-1.5">
                <Braces className="size-3.5 shrink-0 text-success" />
                <span className="text-ui text-success">Valid JSON</span>
              </div>
            )}

            <div className="min-h-0 flex-1">
              <CodeEditor
                value={controller.draft}
                format={document.format}
                readOnly={!canEdit}
                errorLine={controller.problem?.line ?? null}
                ariaLabel={`Edit ${document.name}`}
                onChange={controller.setDraft}
              />
            </div>

            <ConfigVersionsDialog
              isOpen={isHistoryOpen}
              document={document}
              draft={controller.draft}
              canRestore={canEdit}
              onRestored={controller.applyDocument}
              onClose={() => setIsHistoryOpen(false)}
            />
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

/**
 * Why the Format button is off, in the words of the reason it is off.
 *
 * A disabled control that explains nothing reads as broken; one that explains
 * the wrong thing is worse. There are two different reasons, and saying
 * "Reformat this JSON document" while refusing to is neither of them.
 */
function formatHint(format: ConfigFormat, hasProblem: boolean): string {
  if (!canFormat(format)) return NO_FORMATTER_HINT;
  if (hasProblem) return "Fix the error above before formatting.";
  return `Reformat this ${CONFIG_FORMAT_LABELS[format]} document`;
}

function ConfigSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-4 w-40" />
      <div className="space-y-2 pt-3">
        {[92, 70, 84, 60, 76, 50].map((width, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}
