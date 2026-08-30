"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { findNodeById } from "@/lib/tree";
import { nodeVisual } from "@/lib/node-visuals";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

export function RenameDialog() {
  const nodeId = useWorkspaceStore((state) => state.renameRequestId);
  const clearRenameRequest = useWorkspaceStore((state) => state.clearRenameRequest);
  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const tree = useWorkspaceStore(selectTree);

  const inputRef = useRef<HTMLInputElement>(null);
  const node = nodeId ? findNodeById(tree, nodeId) : null;

  const [edited, setEdited] = useState<{ nodeId: string; value: string } | null>(null);
  const draft = edited && edited.nodeId === node?.id ? edited.value : (node?.name ?? "");

  useEffect(() => {
    if (!node) return;
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
      <DialogContent size="sm" className="flex max-h-[85vh] flex-col">
        {node && visual && (
          <>
            <DialogHeader size="sm">
              <DialogTitle className="flex items-center gap-2">
                <visual.Icon aria-hidden="true" className={`size-4 ${visual.colorClass}`} />
                Name this {visual.label.toLowerCase()}
              </DialogTitle>
              <DialogDescription>
                Press Enter to save, Escape to keep the current name.
              </DialogDescription>
            </DialogHeader>

            <DialogBody size="sm">
              <Input
                ref={inputRef}
                value={draft}
                autoFocus
                aria-label="Name"
                onChange={(event) => setEdited({ nodeId: node.id, value: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit();
                  }
                }}
              />
            </DialogBody>

            <DialogFooter size="sm">
              <Button size="sm" variant="outline" onClick={clearRenameRequest}>
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
