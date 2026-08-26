"use client";

import { motion } from "framer-motion";
import { FolderOpen, Search, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: { readonly label: string; readonly href?: string; readonly onClick?: () => void };
}

export function EmptyState({ icon: Icon = FolderOpen, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface">
        <Icon className="size-5 text-faint-foreground" strokeWidth={1.5} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">{description}</p>
      </div>
      {action &&
        (action.href ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </motion.div>
  );
}

export function NotFoundState({ segment }: { segment: string }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="That path no longer exists"
      description={`Nothing in this workspace matches “${segment}”. It may have been renamed, moved or deleted.`}
      action={{ label: "Back to workspace root", href: "/drive" }}
    />
  );
}

export function NoResultsState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No matches"
      description={`Nothing matched “${query}” in this workspace.`}
    />
  );
}
