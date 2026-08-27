"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWatch } from "@/hooks/use-watch";
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
 *
 * A toggle button, not a `Switch`, and the call was close enough to write down.
 *
 * The rule everywhere else in this app is that a setting which is still where
 * you left it gets a `Switch`, because `aria-pressed` announces a momentary
 * action. A watch is persisted on the server, so by that rule it looks like a
 * switch. It stays a button for three reasons, in order of weight:
 *
 * 1. Two of its three call sites pass `isCompact` and render it as a bare glyph
 *    in a dense header. A track-and-thumb has nowhere to shrink to, and one
 *    control that announces itself as a switch in the toolbar and as a button
 *    in the header is worse than either.
 * 2. It commits over the network and has a pending beat where the answer is not
 *    yet known. A switch caught between its two positions describes a state
 *    that does not exist; a button that is busy describes what is happening.
 * 3. It sits among Share and More, where it is read as one of the actions
 *    available on this record rather than as a preference about it — which is
 *    also why the label says what it will do next.
 *
 * `aria-pressed` is the ARIA pattern for exactly that: a command whose effect
 * stays on until it is pressed again.
 */
export function WatchButton({ target, isCompact = false, className }: WatchButtonProps) {
  const { isSupported, isWatching, isPending, toggle } = useWatch(target);

  if (!isSupported) return null;

  const Icon = isWatching ? Eye : EyeOff;
  const variant = isWatching ? "subtle" : "outline";
  const hint = isWatching
    ? "You get notified about new comments here. Click to stop."
    : "Get notified about new comments here.";

  /*
   * Both branches below take `isLoading` rather than the bare `disabled` this
   * had before. An in-flight watch used to look exactly like a watch you are
   * not allowed to change, and the round trip is long enough to see.
   */
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
        {/*
          No `aria-label` on this one. The visible word is the button's name,
          and overriding it with "Stop watching" left the two disagreeing —
          voice control asks for what it can see, and "click Watching" then
          matches nothing on the page. The state it was trying to convey is
          what `aria-pressed` is for.
        */}
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
