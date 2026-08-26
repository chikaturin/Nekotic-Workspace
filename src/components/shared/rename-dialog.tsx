"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { findNodeById } from "@/lib/tree";
import { nodeVisual } from "@/lib/node-visuals";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Naming a node.
 *
 * Mounted once in the shell and driven by `renameRequestId`, so the same
 * surface serves both jobs: renaming something later, and naming something the
 * moment it is created. Creating a folder therefore opens here with the name
 * selected — one step, not "create, find it, open the menu, choose Rename".
 *
 * It replaced a `window.prompt`, which could not be styled, could not be
 * dismissed with Escape consistently, and was blocked outright in some
 * browsers.
 */
export function RenameDialog() {
  const nodeId = useWorkspaceStore((state) => state.renameRequestId);
  const clearRenameRequest = useWorkspaceStore((state) => state.clearRenameRequest);
  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const tree = useWorkspaceStore(selectTree);

  const inputRef = useRef<HTMLInputElement>(null);
  const node = nodeId ? findNodeById(tree, nodeId) : null;

  /**
   * The draft is stored with the node it belongs to, so opening a different
   * node falls back to that node's own name by derivation. Typing is never
   * overwritten, and no effect has to reset anything.
   */
  const [edited, setEdited] = useState<{ nodeId: string; value: string } | null>(null);
  const draft = edited && edited.nodeId === node?.id ? edited.value : (node?.name ?? "");

  useEffect(() => {
    if (!node) return;
    // Select the whole name: the common case is replacing "Untitled folder".
    const frame = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- one focus per node

  function commit() {
    const trimmed = draft.trim();
    if (node && trimmed.length > 0 && trimmed !== node.name) renameNode(node.id, trimmed);
    setEdited(null);
    clearRenameRequest();
  }

  const visual = node ? nodeVisual(node) : null;

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && clearRenameRequest()}>
      <DialogContent className="max-w-sm p-5">
        {node && visual && (
          <>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <visual.Icon className={`size-4 ${visual.colorClass}`} />
              Name this {visual.label.toLowerCase()}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
              Press Enter to save, Escape to keep the current name.
            </DialogDescription>

            <Input
              ref={inputRef}
              value={draft}
              autoFocus
              aria-label="Name"
              onChange={(event) =>
                setEdited({ nodeId: node.id, value: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
              }}
              className="mt-3"
            />

            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={clearRenameRequest}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                disabled={draft.trim().length === 0}
                onClick={commit}
              >
                Save name
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
