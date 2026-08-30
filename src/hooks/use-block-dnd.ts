"use client";

import { useCallback, useState, type DragEvent } from "react";

const BLOCK_MIME = "application/x-nekotic-block";

export type DropSide = "before" | "after";

export interface BlockDropIndicator {
  readonly index: number;
  readonly side: DropSide;
}

export interface BlockDnd {
  readonly draggingBlockId: string | null;
  readonly indicator: BlockDropIndicator | null;
  readonly onDragStart: (
    blockId: string,
  ) => (event: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
  readonly onDragOver: (
    index: number,
  ) => (event: DragEvent<HTMLElement>) => void;
  readonly onDrop: (index: number) => (event: DragEvent<HTMLElement>) => void;
}

export function useBlockDnd(
  onReorder: (blockId: string, toIndex: number) => void,
  isEditable: boolean,
): BlockDnd {
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<BlockDropIndicator | null>(null);

  const onDragStart = useCallback(
    (blockId: string) => (event: DragEvent<HTMLElement>) => {
      if (!isEditable) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.setData(BLOCK_MIME, blockId);
      event.dataTransfer.effectAllowed = "move";
      setDraggingBlockId(blockId);
    },
    [isEditable],
  );

  const onDragEnd = useCallback(() => {
    setDraggingBlockId(null);
    setIndicator(null);
  }, []);

  const onDragOver = useCallback(
    (index: number) => (event: DragEvent<HTMLElement>) => {
      if (
        !isEditable ||
        !Array.from(event.dataTransfer.types).includes(BLOCK_MIME)
      )
        return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const bounds = event.currentTarget.getBoundingClientRect();
      const side: DropSide =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      setIndicator((previous) =>
        previous?.index === index && previous.side === side
          ? previous
          : { index, side },
      );
    },
    [isEditable],
  );

  const onDrop = useCallback(
    (index: number) => (event: DragEvent<HTMLElement>) => {
      if (!isEditable) return;

      const blockId = event.dataTransfer.getData(BLOCK_MIME);
      if (!blockId) return;

      event.preventDefault();
      event.stopPropagation();

      const side = indicator?.side ?? "before";
      onReorder(blockId, side === "before" ? index : index + 1);

      setDraggingBlockId(null);
      setIndicator(null);
    },
    [indicator, isEditable, onReorder],
  );

  return {
    draggingBlockId,
    indicator,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
  };
}
