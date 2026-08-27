"use client";

import { History, Lock, Pencil, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { SecretAuditPanel } from "@/components/devtools/secret-audit-panel";
import { SecretEditorPanel } from "@/components/devtools/secret-editor-panel";
import { SecretList } from "@/components/devtools/secret-list";
import { SecretVersionsDialog } from "@/components/versions/version-dialogs";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { NodeTitleInput } from "@/components/shared/node-title-input";
import { ListLoadingState } from "@/components/shared/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffectiveRole, usePermissions } from "@/hooks/use-permissions";
import { useSecretDocument } from "@/hooks/use-secret-document";
import { useSecretEditor } from "@/hooks/use-secret-editor";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { ROLE_LABELS } from "@/lib/permissions";
import type { DocumentNode } from "@/types";

/**
 * DV-SEC-23 — secrets shown as masks by default, with an editor.
 *
 * The page never receives plaintext with the document: values arrive one at a
 * time from a permission-checked call, live in component state, and are dropped
 * on a timer. Nothing is persisted and nothing is logged.
 *
 * Two modes, and the split is deliberate. Reading is the common case and stays
 * masked; writing is rarer, more consequential, and needs a different shape of
 * control — so Edit is a mode rather than every row being a live input. It also
 * means the read view can offer selection and bulk copy without any of it being
 * one mis-click away from a rotation.
 *
 * This is not a code editor and must not become one. A raw text area holding a
 * production credential file is exactly the screenshot nobody wants: every
 * value visible at once, no per-key audit, and a save that reads as rotating
 * everything. Config documents are the surface for text; this one is a list.
 */
export function SecretDocumentPage({ node }: { node: DocumentNode }) {
  const can = usePermissions(node);
  const role = useEffectiveRole(node);
  const controller = useSecretDocument(node.id);
  const secretDocument = controller.state.status === "success" ? controller.state.data : null;
  const editor = useSecretEditor(secretDocument, controller.apply);

  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const canReveal = can("secret.reveal");
  const canRotate = can("secret.rotate");

  useUnsavedWarning(isEditing && editor.isDirty);

  /** Leaving edit mode never throws work away without asking. */
  function leaveEditing() {
    if (editor.isDirty) {
      setIsDiscarding(true);
      return;
    }
    setIsEditing(false);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-xl">{node.icon}</span>

        <div className="min-w-0 flex-1">
          <NodeTitleInput
            node={node}
            canRename={can("node.rename")}
            className="w-full px-1 py-0.5"
          />
          <p className="metric truncate px-1 text-body text-faint-foreground">
            Encrypted at rest · every reveal, copy and rotation is recorded
          </p>
        </div>

        <Badge variant={canReveal ? "success" : "default"} className="shrink-0">
          {canReveal ? `${ROLE_LABELS[role]} access` : `${ROLE_LABELS[role]} — masked only`}
        </Badge>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {isEditing ? (
            <>
              <Button size="sm" variant="ghost" onClick={leaveEditing}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={!editor.canSave || editor.isSaving}
                onClick={() => void editor.save().then((ok) => ok && setIsEditing(false))}
              >
                {editor.isSaving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={!canRotate || secretDocument === null}
                title={
                  canRotate
                    ? "Add, rename, replace or remove secrets"
                    : "Changing secrets needs the Admin role"
                }
                onClick={() => setIsEditing(true)}
              >
                <Pencil />
                Edit
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                disabled={secretDocument === null}
                onClick={() => setIsHistoryOpen(true)}
              >
                <History />
                Rotation history
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant={isAuditOpen ? "subtle" : "ghost"}
            className="gap-1.5"
            aria-pressed={isAuditOpen}
            onClick={() => setIsAuditOpen((open) => !open)}
          >
            <ShieldCheck />
            Audit log
          </Button>
        </div>
      </header>

      {secretDocument && (
        <SecretVersionsDialog
          isOpen={isHistoryOpen}
          document={secretDocument}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {!canReveal && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
          <Lock aria-hidden="true" className="size-3.5 shrink-0 text-faint-foreground" />
          <p className="text-ui text-muted-foreground">
            Only owners and admins can reveal or copy these values. Asking anyway is refused by the
            server and still recorded.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <AsyncBoundary
            state={controller.state}
            onRetry={controller.reload}
            loading={<ListLoadingState />}
          >
            {(document) =>
              isEditing ? (
                <SecretEditorPanel
                  editor={editor}
                  canReveal={canReveal}
                  onReveal={controller.take}
                />
              ) : (
                <SecretList document={document} controller={controller} canReveal={canReveal} />
              )
            }
          </AsyncBoundary>
        </div>

        {isAuditOpen && <SecretAuditPanel nodeId={node.id} />}
      </div>

      <ConfirmDialog
        isOpen={isDiscarding}
        title="Discard your changes?"
        description="You have unsaved changes to these secrets. Discarding leaves the stored values exactly as they are."
        confirmLabel="Discard changes"
        isDestructive
        onClose={() => setIsDiscarding(false)}
        onConfirm={() => {
          setIsDiscarding(false);
          editor.reset();
          setIsEditing(false);
        }}
      />
    </div>
  );
}
