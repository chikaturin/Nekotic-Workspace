"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { FileMetadataTable } from "@/components/files/file-metadata-table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { findPathToId } from "@/lib/tree";
import { selectTree, useWorkspaceStore } from "@/store/workspace-store";
import type { FileNode } from "@/types";

/** Everything the file knows about itself, always on screen next to it. */
export function ViewerDetails({ node }: { node: FileNode }) {
  const tree = useWorkspaceStore(selectTree);

  const location = useMemo(
    () => findPathToId(tree, node.id).slice(0, -1).map((item) => item.name),
    [tree, node.id],
  );

  return (
    <aside
      aria-label="File details"
      className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-border bg-surface p-4 md:w-[20rem] md:border-l md:border-t-0"
    >
      <Section title="Location">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-muted-foreground">
          <li>Workspace</li>
          {location.map((name) => (
            <li key={name} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-faint-foreground" />
              {name}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Metadata">
        <FileMetadataTable node={node} />
      </Section>

      <Section title="Owner">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
          <UserAvatar user={node.owner} className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{node.owner.name}</p>
            <p className="metric truncate text-[10px] text-faint-foreground">{node.owner.email}</p>
          </div>
        </div>
      </Section>

      {(node.isShared || node.isFavorite || node.isTrashed) && (
        <Section title="Status">
          <div className="flex flex-wrap gap-1.5">
            {node.isShared && <Badge variant="accent">shared</Badge>}
            {node.isFavorite && <Badge variant="default">favorite</Badge>}
            {node.isTrashed && <Badge variant="danger">in trash</Badge>}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
