"use client";

import { useCallback, useMemo, useState } from "react";
import { matchBlockCommands, type BlockCommand } from "@/lib/block-commands";

export interface SlashMenuState {
  readonly isOpen: boolean;
  /** Block the menu was opened from. */
  readonly blockId: string | null;
  readonly query: string;
  readonly activeIndex: number;
  readonly results: readonly BlockCommand[];
}

export interface SlashMenu extends SlashMenuState {
  readonly open: (blockId: string) => void;
  readonly close: () => void;
  readonly setQuery: (query: string) => void;
  readonly moveActive: (delta: number) => void;
  /** Command under the cursor, or null when the query matches nothing. */
  readonly activeCommand: BlockCommand | null;
}

const CLOSED: SlashMenuState = {
  isOpen: false,
  blockId: null,
  query: "",
  activeIndex: 0,
  results: [],
};

/**
 * Slash-command state machine. Filtering and ranking live in
 * `lib/block-commands`; this only tracks what is open and highlighted.
 */
export function useSlashMenu(): SlashMenu {
  const [state, setState] = useState<SlashMenuState>(CLOSED);

  const results = useMemo(
    () => (state.isOpen ? matchBlockCommands(state.query) : []),
    [state.isOpen, state.query],
  );

  const open = useCallback((blockId: string) => {
    setState({ isOpen: true, blockId, query: "", activeIndex: 0, results: [] });
  }, []);

  const close = useCallback(() => setState(CLOSED), []);

  const setQuery = useCallback((query: string) => {
    setState((previous) => ({ ...previous, query, activeIndex: 0 }));
  }, []);

  const moveActive = useCallback(
    (delta: number) => {
      setState((previous) => {
        const count = matchBlockCommands(previous.query).length;
        if (count === 0) return previous;

        const next = (previous.activeIndex + delta + count) % count;
        return { ...previous, activeIndex: next };
      });
    },
    [],
  );

  const activeIndex = Math.min(state.activeIndex, Math.max(results.length - 1, 0));

  return {
    ...state,
    results,
    activeIndex,
    activeCommand: results[activeIndex] ?? null,
    open,
    close,
    setQuery,
    moveActive,
  };
}
