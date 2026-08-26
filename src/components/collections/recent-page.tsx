"use client";

import { Clock, FileQuestion, Table2, X } from "lucide-react";
import { EntityRow } from "@/components/collections/entity-row";
import { EmptyState } from "@/components/drive/empty-state";
import { Button } from "@/components/ui/button";
import { RECENT_LIMIT } from "@/config/app";
import { useOpenEntity } from "@/hooks/use-entity-navigation";
import { useRecent } from "@/hooks/use-recent";
import { refKey } from "@/lib/entity-ref";
import { formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { findNodeById, pathLabel } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { EntityRef } from "@/types";

/**
 * Recent (CO-REC-33).
 *
 * A least-recently-used list of the last {@link RECENT_LIMIT} places visited,
 * kept in this browser. Entries are resolved against the live tree on render,
 * so something deleted since the visit says so instead of routing nowhere.
 */
export function RecentPage() {
  const tree = useWorkspaceStore(selectTree);
  const { entries, isHydrated, remove, clear } = useRecent();
  const openEntity = useOpenEntity();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface">
          <Clock className="size-4 text-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight text-foreground">Recent</h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
            The last {RECENT_LIMIT} things you opened, newest first · this browser only
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={entries.length === 0}
          onClick={clear}
          className="gap-1.5"
        >
          <X />
          Clear
        </Button>
      </header>

      <div className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-4">
        {entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={isHydrated ? "Nothing opened yet" : "Reading your history…"}
            description="Open a page, board or record and it appears here."
            action={{ label: "Go to Drive", href: "/drive" }}
          />
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-1.5">
            {entries.map((entry) => {
              const key = refKey(entry.ref);
              const node = findNodeById(tree, entry.ref.nodeId);
              const visual = node ? nodeVisual(node) : null;
              const Icon = visual?.Icon ?? (entry.ref.kind === "row" ? Table2 : FileQuestion);

              return (
                <li key={key}>
                  <EntityRow
                    icon={Icon}
                    iconClassName={visual?.colorClass ?? "text-faint-foreground"}
                    title={entry.ref.label}
                    subtitle={subtitleFor(entry.ref, node ? pathLabel(tree, node.id) : null, entry.visitedAt)}
                    onOpen={() => openEntity(entry.ref)}
                    actions={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${entry.ref.label} from recent`}
                        onClick={() => remove(key)}
                      >
                        <X />
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function subtitleFor(ref: EntityRef, path: string | null, visitedAt: string): string {
  if (path === null) return `No longer in this workspace · ${formatRelativeTime(visitedAt)}`;

  const where = ref.kind === "row" ? `Record · ${path}` : path;
  return `${where} · ${formatRelativeTime(visitedAt)}`;
}
