"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWatch } from "@/hooks/use-watch";
import type { EntityRef } from "@/types";

interface WatchButtonProps {
  readonly target: EntityRef | null;
  readonly isCompact?: boolean;
  readonly className?: string;
}

export function WatchButton({ target, isCompact = false, className }: WatchButtonProps) {
  const { isSupported, isWatching, isPending, toggle } = useWatch(target);

  if (!isSupported) return null;

  const Icon = isWatching ? Eye : EyeOff;
  const variant = isWatching ? "subtle" : "outline";
  const hint = isWatching
    ? "You get notified about new comments here. Click to stop."
    : "Get notified about new comments here.";

  if (isCompact) {
    return (
      <IconButton
        size="icon"
        variant={variant}
        aria-pressed={isWatching}
        aria-label={isWatching ? "Stop watching" : "Watch"}
        tooltip={hint}
        isLoading={isPending}
        onClick={toggle}
        className={className}
      >
        <Icon />
      </IconButton>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          aria-pressed={isWatching}
          isLoading={isPending}
          onClick={toggle}
          className={className}
        >
          <Icon />
          {isWatching ? "Watching" : "Watch"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
