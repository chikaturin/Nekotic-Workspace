"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { applyMention, findMentionQuery, mentionCandidates } from "@/lib/mentions";
import type { DirectoryUser, MentionQuery } from "@/types";

export interface MentionPicker {
  readonly isOpen: boolean;
  readonly query: string;
  readonly candidates: readonly DirectoryUser[];
  readonly activeIndex: number;
  readonly sync: (text: string, caret: number) => void;
  readonly close: () => void;
  readonly choose: (user: DirectoryUser) => void;
  readonly setActiveIndex: (index: number) => void;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

interface MentionPickerInput {
  readonly people: readonly DirectoryUser[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function useMentionPicker({
  people,
  value,
  onChange,
  textareaRef,
}: MentionPickerInput): MentionPicker {
  const [range, setRange] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const candidates = useMemo(
    () => (range ? mentionCandidates(people, range.query) : []),
    [range, people],
  );

  const isOpen = range !== null && candidates.length > 0;

  const sync = useCallback(
    (text: string, caret: number) => {
      const next = findMentionQuery(text, caret);
      setRange(next);

      if (range?.start !== next?.start || range?.query !== next?.query) setActiveIndex(0);
    },
    [range],
  );

  const close = useCallback(() => setRange(null), []);

  const choose = useCallback(
    (user: DirectoryUser) => {
      if (!range) return;

      const next = applyMention(value, range, user);
      onChange(next.text);
      setRange(null);

      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (!element) return;

        element.focus();
        element.setSelectionRange(next.caret, next.caret);
      });
    },
    [range, value, onChange, textareaRef],
  );

  const consume = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isOpen) return false;

      if (event.key === "ArrowDown") {
        consume(event);
        setActiveIndex((index) => (index + 1) % candidates.length);
        return true;
      }

      if (event.key === "ArrowUp") {
        consume(event);
        setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length);
        return true;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const user = candidates[activeIndex] ?? candidates[0];
        if (!user) return false;

        consume(event);
        choose(user);
        return true;
      }

      if (event.key === "Escape") {
        consume(event);
        close();
        return true;
      }

      return false;
    },
    [isOpen, candidates, activeIndex, choose, close, consume],
  );

  return {
    isOpen,
    query: range?.query ?? "",
    candidates,
    activeIndex,
    sync,
    close,
    choose,
    setActiveIndex,
    handleKeyDown,
  };
}
