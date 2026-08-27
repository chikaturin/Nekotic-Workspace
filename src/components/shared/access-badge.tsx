import { Lock } from "lucide-react";
import { isRestricted } from "@/lib/permissions/visibility";
import { cn } from "@/lib/utils";
import type { DriveNode } from "@/types";

/**
 * The padlock on a restricted folder.
 *
 * Safe to render anywhere a node already appears, because a node only reaches
 * a surface through the pruned tree — anybody who can see the lock could
 * already see the folder. It marks a folder as shut *for the people who are
 * in it*; it is never how somebody outside learns one exists.
 */
export function AccessBadge({ node, className }: { readonly node: DriveNode; readonly className?: string }) {
  if (!isRestricted(node)) return null;

  return (
    <Lock
      aria-label="Restricted folder"
      className={cn("size-3 shrink-0 text-faint-foreground", className)}
    />
  );
}
