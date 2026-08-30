"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  hasExternalFiles,
  hasInternalNode,
  readDragPayload,
  readDroppedFiles,
  setDragPayload,
} from "@/lib/dnd";
import { findNodeById, isDescendantOf } from "@/lib/tree";
import { useDndStore } from "@/store/dnd-store";
import { useUploadStore } from "@/store/upload-store";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isContainer, type DriveNode } from "@/types";

export interface DragSourceProps {
  readonly draggable: true;
  readonly onDragStart: (event: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
}

export function useDragSource(node: DriveNode): {
  dragProps: DragSourceProps;
  isDragging: boolean;
} {
  const startDrag = useDndStore((state) => state.startDrag);
  const endDrag = useDndStore((state) => state.endDrag);
  const isDragging = useDndStore((state) => state.draggingNodeId === node.id);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      setDragPayload(event, { nodeId: node.id, type: node.type, name: node.name });
      startDrag(node.id);
    },
    [node.id, node.type, node.name, startDrag],
  );

  return {
    dragProps: { draggable: true, onDragStart, onDragEnd: endDrag },
    isDragging,
  };
}

interface DropTargetOptions {
  readonly targetId: string | null;
  readonly disabled?: boolean;
}

export interface DropTargetProps {
  readonly onDragEnter: (event: DragEvent<HTMLElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLElement>) => void;
  readonly onDragLeave: (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLElement>) => void;
}

export function useDropTarget({ targetId, disabled = false }: DropTargetOptions): {
  dropProps: DropTargetProps;
  isOver: boolean;
} {
  const tree = useWorkspaceStore(selectTree);
  const moveNode = useWorkspaceStore((state) => state.moveNode);
  const startUploads = useUploadStore((state) => state.startUploads);
  const draggingNodeId = useDndStore((state) => state.draggingNodeId);
  const endDrag = useDndStore((state) => state.endDrag);

  const [isOver, setIsOver] = useState(false);
  const depth = useRef(0);

  const canAccept = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return false;
      if (targetId !== null) {
        const target = findNodeById(tree, targetId);
        if (!target || !isContainer(target)) return false;
      }
      if (hasExternalFiles(event)) return true;
      if (!hasInternalNode(event)) return false;
      if (!draggingNodeId) return true;
      if (draggingNodeId === targetId) return false;
      if (targetId !== null && isDescendantOf(tree, draggingNodeId, targetId)) return false;

      const dragged = findNodeById(tree, draggingNodeId);
      return dragged ? dragged.parentId !== targetId : true;
    },
    [disabled, targetId, tree, draggingNodeId],
  );

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!canAccept(event)) return;
      event.preventDefault();
      depth.current += 1;
      setIsOver(true);
    },
    [canAccept],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!canAccept(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = hasExternalFiles(event) ? "copy" : "move";
    },
    [canAccept],
  );

  const onDragLeave = useCallback(() => {
    depth.current = Math.max(depth.current - 1, 0);
    if (depth.current === 0) setIsOver(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      depth.current = 0;
      setIsOver(false);
      if (!canAccept(event)) return;

      event.preventDefault();
      event.stopPropagation();

      const files = readDroppedFiles(event);
      if (files.length > 0) {
        void startUploads(files, targetId);
      } else {
        const payload = readDragPayload(event);
        if (payload) moveNode(payload.nodeId, targetId);
      }

      endDrag();
    },
    [canAccept, endDrag, moveNode, startUploads, targetId],
  );

  return {
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
    isOver,
  };
}
