"use client";

import { usePathname } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { useTitleFocus } from "@/hooks/use-title-focus";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn, slugify } from "@/lib/utils";
import type { DriveNode } from "@/types";

interface NodeTitleInputProps {
  readonly node: DriveNode;
  /** `can("node.rename")`, resolved by the caller. */
  readonly canRename: boolean;
  readonly className?: string;
}

/**
 * A drive node's name, editable in place at the top of its own surface.
 *
 * Renaming used to be reachable only from the tree or the drive listing, which
 * meant the one screen actually *about* a document was the one screen where its
 * name was a read-only heading — and the "create, then type the name" flow every
 * other kind of item gets ended at a title that could not be typed into.
 *
 * The awkward part is the URL. A node's slug comes from its name, and these
 * pages are addressed by slug chain, so committing a rename leaves the browser
 * on a path that no longer resolves to anything. The fix is to move with it:
 * swap the last segment of the current path and navigate. That keeps whichever
 * section the reader came in through — `/drive` and `/files` both address the
 * same nodes — and `useOpenNode` takes care of a name the static export has
 * never heard of.
 *
 * Escape reverts, because a half-typed name committed by a stray blur is worse
 * than losing the edit.
 */
export function NodeTitleInput({ node, canRename, className }: NodeTitleInputProps) {
  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const openNode = useOpenNode();
  const pathname = usePathname();
  const inputRef = useTitleFocus(node.id, canRename);

  /**
   * The draft is stored with the node it belongs to, so opening a different one
   * falls back to that node's own name by derivation — no effect resets
   * anything, and a half-typed name is never clobbered by a background update.
   */
  const [edited, setEdited] = useState<{ nodeId: string; value: string } | null>(null);
  const draft = edited?.nodeId === node.id ? edited.value : node.name;

  function commit() {
    const trimmed = draft.trim();
    setEdited(null);

    if (trimmed.length === 0 || trimmed === node.name) return;

    renameNode(node.id, trimmed);

    const next = hrefWithSlug(pathname, slugify(trimmed));
    if (next) openNode(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEdited(null);
      event.currentTarget.blur();
    }
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      readOnly={!canRename}
      aria-label="Name"
      placeholder="Untitled"
      spellCheck={false}
      onChange={(event) => setEdited({ nodeId: node.id, value: event.target.value })}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-w-0 truncate rounded-sm bg-transparent text-title font-semibold tracking-tight text-foreground outline-none",
        "placeholder:text-faint-foreground focus-visible:ring-2 focus-visible:ring-ring",
        canRename ? "hover:bg-hover" : "cursor-default",
        className,
      )}
    />
  );
}

/**
 * The current path with its last segment replaced.
 *
 * Rebuilding from the tree instead would be more direct and is wrong: it
 * always answers `/drive/…`, so renaming from the Files section would silently
 * move the reader to a different one. Null at a section root, which has no
 * node segment to swap.
 */
function hrefWithSlug(pathname: string, slug: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  return `/${[...segments.slice(0, -1), slug].join("/")}`;
}
