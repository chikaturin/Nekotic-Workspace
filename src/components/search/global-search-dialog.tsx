"use client";

import { ArrowRight, Clock, FolderPlus, LoaderCircle, Search, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resultVisual } from "@/components/search/search-result-visuals";
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
import { SMART_VIEWS } from "@/config/app";
import { useCurrentTarget } from "@/hooks/use-current-target";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import { useRecent } from "@/hooks/use-recent";
import { refKey } from "@/lib/entity-ref";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef, SearchResult } from "@/types";

export function GlobalSearchDialog() {
  const router = useRouter();
  const isOpen = useWorkspaceStore((state) => state.isSearchOpen);
  const setSearchOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const { targetId, targetName } = useCurrentTarget();

  const [query, setQuery] = useState("");
  const search = useGlobalSearch(query);
  const openEntity = useOpenEntity();
  const { entries } = useRecent();

  const hasQuery = query.trim().length > 0;
  const isSearching =
    hasQuery && (search.isTyping || search.state.status === "loading");
  const failure = search.state.status === "error" ? search.state.error : null;

  function close() {
    setSearchOpen(false);
    setQuery("");
  }

  function open(ref: EntityRef) {
    close();
    openEntity(ref);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(next) => (next ? setSearchOpen(true) : close())}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Search the workspace</DialogTitle>
        <DialogDescription className="sr-only">
          Find pages, records, files and comments, or run a quick action.
        </DialogDescription>

        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, records, files and comments… try API-003"
          />

          <CommandList>
            {failure && (
              <div className="px-3 py-6">
                <p className="text-center text-lead text-danger">{failure.message}</p>
                <p className="mt-1 text-center text-ui text-muted-foreground">
                  {failure.detail ?? "The search did not complete. Try again in a moment."}
                </p>
              </div>
            )}

            {hasQuery && !isSearching && !failure && search.total === 0 && (
              <CommandEmpty>
                Nothing matches <span className="text-foreground">{query}</span>
              </CommandEmpty>
            )}

            {isSearching && !failure && search.total === 0 && (
              <p className="flex items-center justify-center gap-2 py-10 text-lead text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" />
                Searching the workspace…
              </p>
            )}

            {search.groups.map((group) => (
              <CommandGroup
                key={group.kind}
                heading={`${group.label} (${group.results.length})`}
              >
                {group.results.map((result) => (
                  <ResultItem key={`${group.kind}:${result.id}`} result={result} onOpen={open} />
                ))}
              </CommandGroup>
            ))}

            {!hasQuery && entries.length > 0 && (
              <CommandGroup heading="Recent">
                {entries.slice(0, 5).map((entry) => (
                  <CommandItem
                    key={refKey(entry.ref)}
                    value={refKey(entry.ref)}
                    onSelect={() => open(entry.ref)}
                  >
                    <Clock className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{entry.ref.label}</span>
                    <span className="metric truncate text-body text-faint-foreground">
                      {entry.ref.kind}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!hasQuery && (
              <>
                <CommandSeparator />

                <CommandGroup heading="Quick actions">
                  <CommandItem
                    value="new-folder"
                    onSelect={() => {
                      void createFolder(targetId, "Untitled folder");
                      close();
                    }}
                  >
                    <FolderPlus className="size-4 text-muted-foreground" />
                    <span className="flex-1">New folder in {targetName}</span>
                    <Kbd>N</Kbd>
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

function ResultItem({
  result,
  onOpen,
}: {
  readonly result: SearchResult;
  readonly onOpen: (ref: EntityRef) => void;
}) {
  const { Icon, colorClass } = resultVisual(result.kind);

  return (
    <CommandItem value={`${result.kind}:${result.id}`} onSelect={() => onOpen(result.ref)}>
      <Icon className={cn("size-4 shrink-0", colorClass)} />

      <span className="min-w-0 flex-1">
        <span className="block truncate">{result.title}</span>
        {result.snippet && (
          <span className="block truncate text-body text-muted-foreground">
            {result.snippet}
          </span>
        )}
      </span>

      <span className="metric max-w-[45%] truncate text-body text-faint-foreground">
        {result.subtitle}
      </span>
    </CommandItem>
  );
}

function SmartViewIcon({ id }: { id: string }) {
  const className = "size-4 text-muted-foreground";
  if (id === "favorites") return <Star className={className} />;
  if (id === "recent") return <Clock className={className} />;
  if (id === "trash") return <Trash2 className={className} />;
  return <Search className={className} />;
}
