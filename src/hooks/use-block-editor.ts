"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  convertBlock,
  createBlock,
  duplicateBlock,
  findBlock,
  indexOfBlock,
  insertBlockAfter,
  isTextualBlock,
  mergeWithPrevious,
  moveBlockBy,
  moveBlockToInsertionIndex,
  removeBlock,
  splitBlock,
  updateBlock,
  withText,
} from "@/lib/blocks";
import { detectMarkdownShortcut } from "@/lib/block-commands";
import { useBlockIds } from "@/hooks/use-block-ids";
import type { Block, BlockType, CaretPosition, FocusRequest } from "@/types";

interface UseBlockEditorInput {
  readonly blocks: readonly Block[];
  readonly onChange: (blocks: readonly Block[]) => void;
  readonly isEditable: boolean;
}

export interface BlockEditorApi {
  readonly focusRequest: FocusRequest | null;
  readonly requestFocus: (blockId: string, position?: CaretPosition | number) => void;
  readonly setText: (blockId: string, text: string) => void;
  readonly patch: (blockId: string, updater: (block: Block) => Block) => void;
  readonly toggleCheck: (blockId: string) => void;
  readonly splitAt: (blockId: string, caretOffset: number) => void;
  readonly mergeBackward: (blockId: string) => void;
  readonly remove: (blockId: string) => void;
  readonly duplicate: (blockId: string) => void;
  readonly convert: (blockId: string, type: BlockType) => void;
  readonly applyCommand: (blockId: string, type: BlockType) => void;
  readonly insertAfter: (blockId: string, type: BlockType) => void;
  readonly appendBlock: (type?: BlockType) => void;
  readonly moveBy: (blockId: string, delta: number) => void;
  readonly moveToInsertionIndex: (blockId: string, insertionIndex: number) => void;
  readonly focusSibling: (blockId: string, direction: -1 | 1) => void;
}

export function useBlockEditor({ blocks, onChange, isEditable }: UseBlockEditorInput): BlockEditorApi {
  const nextId = useBlockIds();
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const blocksRef = useRef(blocks);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const requestFocus = useCallback((blockId: string, position: CaretPosition | number = "end") => {
    setFocusRequest((previous) => ({
      blockId,
      position,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  }, []);

  const commit = useCallback(
    (next: readonly Block[]) => {
      if (next === blocksRef.current) return;

      blocksRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const current = useCallback(() => blocksRef.current, []);

  const setText = useCallback(
    (blockId: string, text: string) => {
      if (!isEditable) return;

      const block = findBlock(current(), blockId);
      if (!block) return;

      if (isTextualBlock(block) && block.type === "paragraph") {
        const shortcut = detectMarkdownShortcut(text);
        if (shortcut) {
          commit(
            updateBlock(current(), blockId, (current) =>
              withText(convertBlock(current, shortcut.type, nextId), shortcut.rest),
            ),
          );
          requestFocus(blockId, shortcut.rest.length);
          return;
        }
      }

      commit(updateBlock(current(), blockId, (current) => withText(current, text)));
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const patch = useCallback(
    (blockId: string, updater: (block: Block) => Block) => {
      if (!isEditable) return;
      commit(updateBlock(current(), blockId, updater));
    },
    [current, commit, isEditable],
  );

  const toggleCheck = useCallback(
    (blockId: string) => {
      if (!isEditable) return;
      commit(
        updateBlock(current(), blockId, (block) =>
          block.type === "checklist" ? { ...block, isChecked: !block.isChecked } : block,
        ),
      );
    },
    [current, commit, isEditable],
  );

  const splitAt = useCallback(
    (blockId: string, caretOffset: number) => {
      if (!isEditable) return;

      const result = splitBlock(current(), blockId, caretOffset, nextId);
      commit(result.blocks);
      requestFocus(result.focusBlockId, "start");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const mergeBackward = useCallback(
    (blockId: string) => {
      if (!isEditable) return;

      const result = mergeWithPrevious(current(), blockId, nextId);
      commit(result.blocks);
      if (result.focusBlockId) requestFocus(result.focusBlockId, result.caretOffset);
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const remove = useCallback(
    (blockId: string) => {
      if (!isEditable) return;

      const index = indexOfBlock(current(), blockId);
      const next = removeBlock(current(), blockId, nextId);
      commit(next);

      const neighbour = next[Math.max(0, index - 1)];
      if (neighbour) requestFocus(neighbour.id, "end");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const duplicate = useCallback(
    (blockId: string) => {
      if (!isEditable) return;
      commit(duplicateBlock(current(), blockId, nextId));
    },
    [current, commit, isEditable, nextId],
  );

  const convert = useCallback(
    (blockId: string, type: BlockType) => {
      if (!isEditable) return;

      commit(updateBlock(current(), blockId, (block) => convertBlock(block, type, nextId)));
      requestFocus(blockId, "end");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const applyCommand = useCallback(
    (blockId: string, type: BlockType) => {
      if (!isEditable) return;

      commit(
        updateBlock(current(), blockId, (block) =>
          convertBlock(withText(block, ""), type, nextId),
        ),
      );
      requestFocus(blockId, "start");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const insertAfter = useCallback(
    (blockId: string, type: BlockType) => {
      if (!isEditable) return;

      const block = createBlock(type, nextId());
      commit(insertBlockAfter(current(), blockId, block));
      requestFocus(block.id, "start");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const appendBlock = useCallback(
    (type: BlockType = "paragraph") => {
      if (!isEditable) return;

      const blocks = current();
      const last = blocks[blocks.length - 1];
      const block = createBlock(type, nextId());

      commit(last ? insertBlockAfter(blocks, last.id, block) : [block]);
      requestFocus(block.id, "start");
    },
    [current, commit, isEditable, nextId, requestFocus],
  );

  const moveBy = useCallback(
    (blockId: string, delta: number) => {
      if (!isEditable) return;
      commit(moveBlockBy(current(), blockId, delta));
      requestFocus(blockId, "end");
    },
    [current, commit, isEditable, requestFocus],
  );

  const moveToInsertionIndex = useCallback(
    (blockId: string, insertionIndex: number) => {
      if (!isEditable) return;
      commit(moveBlockToInsertionIndex(current(), blockId, insertionIndex));
    },
    [current, commit, isEditable],
  );

  const focusSibling = useCallback(
    (blockId: string, direction: -1 | 1) => {
      const blocks = current();
      const index = indexOfBlock(blocks, blockId);
      const target = blocks[index + direction];
      if (target) requestFocus(target.id, direction === -1 ? "end" : "start");
    },
    [current, requestFocus],
  );

  return useMemo(
    () => ({
      focusRequest,
      requestFocus,
      setText,
      patch,
      toggleCheck,
      splitAt,
      mergeBackward,
      remove,
      duplicate,
      convert,
      applyCommand,
      insertAfter,
      appendBlock,
      moveBy,
      moveToInsertionIndex,
      focusSibling,
    }),
    [
      focusRequest,
      requestFocus,
      setText,
      patch,
      toggleCheck,
      splitAt,
      mergeBackward,
      remove,
      duplicate,
      convert,
      applyCommand,
      insertAfter,
      appendBlock,
      moveBy,
      moveToInsertionIndex,
      focusSibling,
    ],
  );
}
