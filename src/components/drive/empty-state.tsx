"use client";

import { FolderOpen, TriangleAlert, type LucideIcon } from "lucide-react";
import { StatePanel, type StatePanelTone } from "@/components/shared/state-panels";

interface EmptyStateProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description: string;
  /**
   * Optional, and `neutral` unless asked otherwise: an empty list is the
   * ordinary state of a new folder, not a fault. It is here for the states
   * that are empty *because* something is wrong — a path that no longer
   * resolves — where the caution icon needs chrome that agrees with it.
   */
  readonly tone?: StatePanelTone;
  readonly action?: { readonly label: string; readonly href?: string; readonly onClick?: () => void };
}

/**
 * Drive's empty states. They are `StatePanel` with a taller minimum, rather
 * than a second implementation of the same card — the two used to be copies of
 * each other, which is exactly how two identical states drift apart.
 */
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
