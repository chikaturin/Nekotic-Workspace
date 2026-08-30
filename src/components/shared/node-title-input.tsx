"use client";

import { usePathname } from "next/navigation";
import { useState, type KeyboardEvent } from "react";
import { useOpenNode } from "@/hooks/use-open-node";
import { useTitleFocus } from "@/hooks/use-title-focus";
import { hrefAfterRename } from "@/lib/rename-navigation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { DriveNode } from "@/types";

interface NodeTitleInputProps {
  readonly node: DriveNode;
  readonly canRename: boolean;
  readonly className?: string;
}

export function NodeTitleInput({ node, canRename, className }: NodeTitleInputProps) {
  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const openNode = useOpenNode();
  const pathname = usePathname();
  const inputRef = useTitleFocus(node.id, canRename);

  const [edited, setEdited] = useState<{ nodeId: string; value: string } | null>(null);
  const draft = edited?.nodeId === node.id ? edited.value : node.name;

  function commit() {
    const trimmed = draft.trim();
    setEdited(null);

    if (trimmed.length === 0 || trimmed === node.name) return;

    renameNode(node.id, trimmed);

    const next = hrefAfterRename(pathname, node.id);
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
