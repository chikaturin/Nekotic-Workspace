"use client";

import { Braces, History, TriangleAlert, Wand2 } from "lucide-react";
import { useState } from "react";
import { CodeEditor } from "@/components/devtools/code-editor";
import { EnvironmentPicker } from "@/components/devtools/environment-picker";
import { VersionHistoryPanel } from "@/components/devtools/version-history-panel";
import { SaveIndicator } from "@/components/document/save-indicator";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useConfigDocument } from "@/hooks/use-config-document";
import { useHotkey } from "@/hooks/use-hotkey";
import { formatJson } from "@/lib/json-lint";
import type { DocumentNode } from "@/types";

/**
 * DV-CFG-22 — configuration as raw text with syntax colour, JSON validation
 * and a version history that can be restored from.
 */
export function ConfigDocumentPage({ node }: { node: DocumentNode }) {
  const capabilities = useCapabilities(node);
  const controller = useConfigDocument(node.id);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  useHotkey("mod+s", () => void controller.save(), { enableInInputs: true });

  const canEdit = capabilities.edit;

  return (
    <div className="flex h-full flex-col bg-background">
      <AsyncBoundary state={controller.state} onRetry={controller.reload} loading={<ConfigSkeleton />}>
        {(document) => (
          <>
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <span className="text-xl">{node.icon}</span>

              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
                  {document.name}
                </h1>
                <p className="metric truncate text-[11px] text-faint-foreground">
                  {document.format.toUpperCase()} · v{document.version} · {document.updatedBy.name}
                </p>
              </div>

              <div className="ml-2 flex items-center gap-2">
                <EnvironmentPicker
                  optionId={document.environmentOptionId}
                  canEdit={canEdit}
                  canManage={capabilities.manage}
                  onChange={(optionId) => void controller.setEnvironment(optionId)}
                />
                {!canEdit && <Badge variant="default">read only</Badge>}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <SaveIndicator
                  state={controller.saveState}
                  onRetry={() => void controller.save()}
                  isReadOnly={!canEdit}
                />

                {document.format === "json" && canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    disabled={controller.problem !== null}
                    onClick={() => controller.setDraft(formatJson(controller.draft))}
                  >
                    <Wand2 />
                    Format
                  </Button>
                )}

                <Button
                  size="sm"
                  variant={isHistoryOpen ? "subtle" : "ghost"}
                  className="gap-1.5"
                  aria-pressed={isHistoryOpen}
                  onClick={() => setIsHistoryOpen((open) => !open)}
                >
                  <History />
                  History
                </Button>

                <Button
                  size="sm"
                  variant="default"
                  disabled={!canEdit || !controller.isDirty || controller.saveState.status === "saving"}
                  onClick={() => void controller.save()}
                >
                  Save
                </Button>
              </div>
            </header>

            {controller.problem && (
              <div className="flex shrink-0 items-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-1.5">
                <TriangleAlert className="size-3.5 shrink-0 text-danger" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-danger">
                  {controller.problem.message}
                </span>
                <span className="metric shrink-0 text-[11px] text-danger/80">
                  line {controller.problem.line}, column {controller.problem.column}
                </span>
              </div>
            )}

            {document.format === "json" && !controller.problem && controller.isDirty && (
              <div className="flex shrink-0 items-center gap-2 border-b border-success/30 bg-success/10 px-4 py-1.5">
                <Braces className="size-3.5 shrink-0 text-success" />
                <span className="text-[12px] text-success">Valid JSON</span>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 min-w-0 flex-1">
                <CodeEditor
                  value={controller.draft}
                  format={document.format}
                  readOnly={!canEdit}
                  errorLine={controller.problem?.line ?? null}
                  ariaLabel={`Edit ${document.name}`}
                  onChange={controller.setDraft}
                />
              </div>

              {isHistoryOpen && (
                <VersionHistoryPanel
                  nodeId={node.id}
                  currentVersion={document.version}
                  canEdit={canEdit}
                  onRestored={controller.applyDocument}
                />
              )}
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
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
