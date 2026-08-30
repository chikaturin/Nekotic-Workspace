"use client";

import { FolderOpen, TriangleAlert, type LucideIcon } from "lucide-react";
import { StatePanel, type StatePanelTone } from "@/components/shared/state-panels";

interface EmptyStateProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly tone?: StatePanelTone;
  readonly action?: { readonly label: string; readonly href?: string; readonly onClick?: () => void };
}

export function EmptyState({ icon = FolderOpen, title, description, tone, action }: EmptyStateProps) {
  return (
    <StatePanel
      icon={icon}
      title={title}
      description={description}
      className="min-h-[320px]"
      hasActionIcon={false}
      {...(tone ? { tone } : {})}
      {...(action ? { action } : {})}
    />
  );
}

export function NotFoundState({ segment }: { segment: string }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      tone="warning"
      title="That path no longer exists"
      description={`Nothing in this workspace matches “${segment}”. It may have been renamed, moved or deleted.`}
      action={{ label: "Back to workspace root", href: "/drive" }}
    />
  );
}
