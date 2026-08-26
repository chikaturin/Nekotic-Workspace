"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { BlockEditor } from "@/components/document/block-editor";
import { DocumentHeader } from "@/components/document/document-header";
import { EditorToolbar } from "@/components/document/editor-toolbar";
import { LockedBanner } from "@/components/document/locked-banner";
import { MovePageDialog } from "@/components/document/move-page-dialog";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { StatePanel } from "@/components/shared/state-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlockEditor } from "@/hooks/use-block-editor";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDocument } from "@/hooks/use-document";
import { useDocumentActions } from "@/hooks/use-document-actions";
import { useHotkey } from "@/hooks/use-hotkey";
import { hasUnsavedWork } from "@/lib/autosave";
import { cn } from "@/lib/utils";
import type { DocumentNode } from "@/types";

interface DocumentPageProps {
  readonly node: DocumentNode;
}

/**
 * Page surface for a document node: header, read-only banner, insert toolbar
 * and the block editor, wrapped in the async states of the document service.
 */
export function DocumentPage({ node }: DocumentPageProps) {
  const controller = useDocument(node.id, node);
  const baseCapabilities = useCapabilities(node);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const actions = useDocumentActions({
    node,
    document: controller.document,
    capabilities: baseCapabilities,
    onDocumentChanged: controller.applyDocument,
  });

  const api = useBlockEditor({
    blocks: controller.draft?.blocks ?? [],
    onChange: controller.setBlocks,
    isEditable: controller.isEditable,
  });

  useHotkey("mod+s", controller.flush, { enableInInputs: true });
  useHotkey("escape", () => setIsFullScreen(false), {
    enabled: isFullScreen,
    enableInInputs: true,
  });

  // Losing edits on navigation is worse than an extra browser prompt.
  const isDirty = hasUnsavedWork(controller.saveState);
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background",
        // Focus mode lifts the page out of the shell and over the whole viewport.
        isFullScreen && "fixed inset-0 z-50 h-dvh animate-in fade-in-0",
      )}
    >
      <AsyncBoundary
        state={controller.state}
        onRetry={controller.reload}
        loading={<DocumentSkeleton />}
      >
        {(document) => {
          const draft = controller.draft;
          if (!draft) return <DocumentSkeleton />;

          return (
            <>
              <DocumentHeader
                document={document}
                draft={draft}
                saveState={controller.saveState}
                capabilities={controller.capabilities}
                baseCapabilities={baseCapabilities}
                actions={actions}
                onTitleChange={controller.setTitle}
                onIconChange={controller.setIcon}
                onRetrySave={controller.retrySave}
                onMoveRequested={() => setIsMoveOpen(true)}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen((full) => !full)}
                onTitleSubmit={() => {
                  const first = draft.blocks[0];
                  if (first) api.requestFocus(first.id, "start");
                }}
              />

              <div className="min-h-0 flex-1 overflow-y-auto bg-background">
                <div className="w-full space-y-3 px-5 py-5 lg:px-8">
                  <LockedBanner
                    document={document}
                    canToggleLock={actions.canToggleLock}
                    onUnlock={() => void actions.toggleLock()}
                    onRestore={() => void actions.setArchived(false)}
                  />

                  <EditorToolbar
                    onInsert={(type) => api.appendBlock(type)}
                    isDisabled={!controller.isEditable}
                  />

                  {draft.blocks.length === 0 ? (
                    <StatePanel
                      icon={FileText}
                      title="This page is empty"
                      description="Use the toolbar above or type “/” in the editor to add your first block."
                    />
                  ) : (
                    <BlockEditor
                      blocks={draft.blocks}
                      api={api}
                      isEditable={controller.isEditable}
                      folderId={node.parentId}
                    />
                  )}
                </div>
              </div>

              <MovePageDialog
                isOpen={isMoveOpen}
                onClose={() => setIsMoveOpen(false)}
                onMove={actions.move}
                nodeId={node.id}
                currentParentId={node.parentId}
              />
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

function DocumentSkeleton() {
  return (
    <div className="w-full space-y-4 px-5 py-6 lg:px-8" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-6 w-64" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="space-y-2.5 pt-2">
        {[92, 78, 85, 60, 70].map((width, index) => (
          <Skeleton key={index} className="h-4" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}
