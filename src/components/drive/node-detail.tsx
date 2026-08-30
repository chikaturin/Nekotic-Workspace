"use client";

import { motion } from "framer-motion";
import { Eye, Star, Users } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/format";
import { nodeVisual } from "@/lib/node-visuals";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isBoard, isFile, type DriveNode } from "@/types";

export function NodeDetail({ node }: { node: DriveNode }) {
  const openPreview = useWorkspaceStore((state) => state.openPreview);
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);
  const { Icon, colorClass, tintClass, label } = nodeVisual(node);

  const facts: readonly { label: string; value: string }[] = [
    { label: "Type", value: label },
    ...(isFile(node)
      ? [
          { label: "Size", value: formatBytes(node.sizeBytes) },
          { label: "Format", value: node.mimeType },
          { label: "Version", value: `v${node.version}` },
        ]
      : []),
    ...(isBoard(node)
      ? [
          { label: "Items", value: `${node.itemCount}` },
          { label: "Open", value: `${node.openCount}` },
        ]
      : []),
    { label: "Created", value: formatDate(node.createdAt) },
    { label: "Modified", value: formatRelativeTime(node.updatedAt) },
  ];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className={cn("flex items-center gap-3 border-b border-hairline p-4", tintClass)}>
        <span className="flex size-11 items-center justify-center rounded-lg bg-background/60">
          <Icon className={cn("size-5", colorClass)} strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lead font-semibold text-foreground">{node.name}</h2>
          <p className="metric truncate text-body text-muted-foreground">{label}</p>
        </div>
        {node.isShared && (
          <Badge variant="accent">
            <Users className="size-3" />
            shared
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="bg-surface px-4 py-3">
            <dt className="text-micro font-semibold uppercase tracking-wider text-faint-foreground">
              {fact.label}
            </dt>
            <dd className="metric mt-0.5 truncate text-ui text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-2 border-t border-hairline p-3">
        <UserAvatar user={node.owner} className="size-6" />
        <span className="text-body text-muted-foreground">{node.owner.name}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => toggleFavorite(node.id)} className="gap-1.5">
            <Star className={cn(node.isFavorite && "fill-accent text-accent")} />
            {node.isFavorite ? "Favorited" : "Favorite"}
          </Button>
          {isFile(node) && (
            <Button size="sm" variant="default" onClick={() => openPreview(node.id)} className="gap-1.5">
              <Eye />
              Preview
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
