"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWatch } from "@/hooks/use-watch";
import { cn } from "@/lib/utils";
import type { EntityRef } from "@/types";

interface WatchButtonProps {
  readonly target: EntityRef | null;
  /** Icon-only, for dense headers. */
  readonly isCompact?: boolean;
  readonly className?: string;
}

/**
 * Follow or unfollow a record, page or board (CO-WAT-28).
 *
 * Watching is what routes activity into the Following tab, so the label says
 * what it will do next rather than describing the current state alone.
 */
export function WatchButton({ target, isCompact = false, className }: WatchButtonProps) {
  const { isSupported, isWatching, isPending, toggle } = useWatch(target);

  if (!isSupported) return null;

  const label = isWatching ? "Watching" : "Watch";
  const hint = isWatching
    ? "You get notified about new comments here. Click to stop."
    : "Get notified about new comments here.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size={isCompact ? "icon" : "sm"}
          variant={isWatching ? "subtle" : "outline"}
          aria-pressed={isWatching}
          aria-label={isWatching ? "Stop watching" : "Watch"}
          disabled={isPending}
          onClick={toggle}
          className={cn(isCompact ? "" : "gap-1.5", className)}
        >
          {isWatching ? <Eye /> : <EyeOff />}
          {!isCompact && label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
