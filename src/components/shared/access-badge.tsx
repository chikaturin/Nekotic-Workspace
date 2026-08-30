import { Lock } from "lucide-react";
import { isRestricted } from "@/lib/permissions/visibility";
import { cn } from "@/lib/utils";
import type { DriveNode } from "@/types";

export function AccessBadge({ node, className }: { readonly node: DriveNode; readonly className?: string }) {
  if (!isRestricted(node)) return null;

  return (
    <Lock
      aria-label="Restricted folder"
      className={cn("size-3 shrink-0 text-faint-foreground", className)}
    />
  );
}
