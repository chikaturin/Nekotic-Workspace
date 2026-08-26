"use client";

import { ArrowRight, Clock, FolderPlus, Search, Star, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SEARCH_RESULT_LIMIT, SMART_VIEWS } from "@/config/app";
import { useCurrentTarget } from "@/hooks/use-current-target";
import { nodeVisual } from "@/lib/node-visuals";
import { searchNodes } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";

/**
 * Global search (⌘K / Ctrl+K): fuzzy-free substring search across the active
 * workspace tree, plus the quick actions people reach for most.
 */
export function CommandPalette() {
  const router = useRouter();
  const isOpen = useWorkspaceStore((state) => state.isSearchOpen);
  const setSearchOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const tree = useWorkspaceStore(selectTree);
  const { targetId, targetName } = useCurrentTarget();

  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchNodes(tree, query, SEARCH_RESULT_LIMIT), [tree, query]);

  function close() {
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setSearchOpen(true) : close())}>
      <DialogContent className="max-w-xl overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Search the workspace</DialogTitle>
        <DialogDescription className="sr-only">
          Find folders, boards and files, or run a quick action.
        </DialogDescription>

        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search folders, boards and files…"
          />

          <CommandList>
            <CommandEmpty>
              No matches for <span className="text-foreground">{query}</span>
            </CommandEmpty>

            {hits.length > 0 && (
              <CommandGroup heading={`Results (${hits.length})`}>
                {hits.map(({ node, path, href }) => {
                  const { Icon, colorClass } = nodeVisual(node);
                  return (
                    <CommandItem
                      key={node.id}
                      value={node.id}
                      onSelect={() => {
                        close();
                        if (node.type === "file") {
                          openPreview(node.id);
                        } else {
                          router.push(href);
                        }
                      }}
                    >
                      <Icon className={cn("size-4 shrink-0", colorClass)} />
                      <span className="min-w-0 flex-1 truncate">{node.name}</span>
                      <span className="metric truncate text-[11px] text-faint-foreground">{path}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {query.length === 0 && (
              <>
                <CommandGroup heading="Quick actions">
                  <CommandItem
                    value="new-folder"
                    onSelect={() => {
                      createFolder(targetId, "Untitled folder");
                      close();
                    }}
                  >
                    <FolderPlus className="size-4 text-muted-foreground" />
                    <span className="flex-1">New folder in {targetName}</span>
                    <Kbd>N</Kbd>
                  </CommandItem>
                  <CommandItem value="upload" onSelect={close}>
                    <Upload className="size-4 text-muted-foreground" />
                    <span className="flex-1">Upload files — drag them onto the grid</span>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Jump to">
                  {SMART_VIEWS.map((view) => (
                    <CommandItem
                      key={view.id}
                      value={view.id}
                      onSelect={() => {
                        router.push(view.href);
                        close();
                      }}
                    >
                      <SmartViewIcon id={view.id} />
                      <span className="flex-1">{view.label}</span>
                      <ArrowRight className="size-3.5 text-faint-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SmartViewIcon({ id }: { id: string }) {
  const className = "size-4 text-muted-foreground";
  if (id === "favorites") return <Star className={className} />;
  if (id === "recent") return <Clock className={className} />;
  if (id === "trash") return <Trash2 className={className} />;
  return <Search className={className} />;
}
