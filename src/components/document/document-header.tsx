"use client";

import { Archive, Lock, Maximize2, Minimize2, Pin } from "lucide-react";
import { useEffect, useRef } from "react";
import { WatchButton } from "@/components/collab/watch-button";
import { DocumentActionsMenu } from "@/components/document/document-actions-menu";
import { SaveIndicator } from "@/components/document/save-indicator";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DocumentActions } from "@/hooks/use-document-actions";
import { countWords } from "@/lib/blocks";
import { useWorkspaceStore } from "@/store/workspace-store";
import { formatCount } from "@/lib/format";
import type {
  CapabilitySet,
  DocumentDraft,
  EntityRef,
  SaveState,
  WorkspaceDocument,
} from "@/types";

const ICON_CHOICES = ["📄", "📘", "💳", "🧩", "🚀", "🧠", "📊", "🔒", "🛠️", "🎯", "🗂️", "✅"] as const;

interface DocumentHeaderProps {
  readonly document: WorkspaceDocument;
  readonly draft: DocumentDraft;
  readonly saveState: SaveState;
  readonly capabilities: CapabilitySet;
  readonly baseCapabilities: CapabilitySet;
  readonly actions: DocumentActions;
  readonly onTitleChange: (title: string) => void;
  readonly onIconChange: (icon: string) => void;
  readonly onRetrySave: () => void;
  readonly onMoveRequested: () => void;
  readonly onHistoryRequested: () => void;
  /** Enter in the title jumps into the body. */
  readonly onTitleSubmit: () => void;
  readonly isFullScreen: boolean;
  readonly onToggleFullScreen: () => void;
  /** The page itself, for the follow button. */
  readonly watchTarget: EntityRef;
  /** Drive node id, so a freshly created page can claim its own title focus. */
  readonly nodeId: string;
}

export function DocumentHeader({
  document,
  draft,
  saveState,
  capabilities,
  baseCapabilities,
  actions,
  onTitleChange,
  onIconChange,
  onRetrySave,
  onMoveRequested,
  onHistoryRequested,
  onTitleSubmit,
  isFullScreen,
  onToggleFullScreen,
  watchTarget,
  nodeId,
}: DocumentHeaderProps) {
  const isEditable = capabilities.edit;
  const titleRef = useRef<HTMLInputElement>(null);
  const titleFocusNodeId = useWorkspaceStore((state) => state.titleFocusNodeId);
  const clearTitleFocus = useWorkspaceStore((state) => state.clearTitleFocus);

  /**
   * A page that was just created opens with its title selected, so typing a
   * name is the first thing that happens rather than a separate edit step.
   * The request is consumed once — coming back later must not steal focus.
   */
  useEffect(() => {
    if (titleFocusNodeId !== nodeId || !isEditable) return;

    const frame = requestAnimationFrame(() => titleRef.current?.select());
    clearTitleFocus();
    return () => cancelAnimationFrame(frame);
  }, [titleFocusNodeId, nodeId, isEditable, clearTitleFocus]);

  return (
    <header className="border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex w-full items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Change page icon"
              disabled={!isEditable}
              className="text-xl"
            >
              {draft.icon}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Page icon</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-0.5 p-1">
              {ICON_CHOICES.map((icon) => (
                <DropdownMenuItem
                  key={icon}
                  onSelect={() => onIconChange(icon)}
                  className="justify-center p-1.5 text-display"
                >
                  {icon}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={titleRef}
          value={draft.title}
          readOnly={!isEditable}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onTitleSubmit();
            }
          }}
          aria-label="Page title"
          placeholder="Untitled"
          className="min-w-0 flex-1 truncate bg-transparent text-display font-semibold tracking-tight text-foreground outline-none placeholder:text-faint-foreground"
        />

        <div className="flex shrink-0 items-center gap-1.5">
          {document.isPinned && (
            <Badge variant="accent">
              <Pin className="size-3" />
              pinned
            </Badge>
          )}
          {document.isLocked && (
            <Badge variant="default">
              <Lock className="size-3" />
              locked
            </Badge>
          )}
          {document.isArchived && (
            <Badge variant="default">
              <Archive className="size-3" />
              archived
            </Badge>
          )}

          <WatchButton target={watchTarget} isCompact />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
                aria-pressed={isFullScreen}
                onClick={onToggleFullScreen}
              >
                {isFullScreen ? <Minimize2 /> : <Maximize2 />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFullScreen ? "Exit full screen · Esc" : "Full screen"}
            </TooltipContent>
          </Tooltip>

          <DocumentActionsMenu
            document={document}
            actions={actions}
            capabilities={baseCapabilities}
            onMoveRequested={onMoveRequested}
            onHistoryRequested={onHistoryRequested}
          />
        </div>
      </div>

      <div className="mt-1.5 flex w-full items-center gap-2 pl-10">
        <UserAvatar user={document.owner} className="size-5" />
        <span className="text-body text-muted-foreground">{document.owner.name}</span>
        <span className="metric text-body text-faint-foreground">
          · {formatCount(countWords(draft.blocks), "word")} · v{document.version}
        </span>
        <span className="ml-auto">
          <SaveIndicator state={saveState} onRetry={onRetrySave} isReadOnly={!isEditable} />
        </span>
      </div>
    </header>
  );
}
