"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "aria-label"> {
  /**
   * Required, and the whole reason this component exists. A button whose only
   * child is an icon has no accessible name at all — a screen reader reads it
   * as "button" — and `aria-label` being optional on `Button` means the
   * omission is silent. Here it is a type error.
   */
  readonly "aria-label": string;
  /**
   * Hover and focus hint. Give it whenever the label is not obvious from the
   * glyph; it is separate from `aria-label` so the two can differ — the label
   * names the action ("Delete column") where the tip can add the shortcut or
   * the consequence.
   */
  readonly tooltip?: ReactNode;
  readonly tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
}

/**
 * A `Button` with an accessible name it cannot forget. Square by default at
 * the 28px control step, which is the size a toolbar or a row affordance
 * wants; pass `size="icon"` for the 32px form used in dialogs and headers.
 *
 * The provider lives once in the app shell, so this only opens a `Tooltip`
 * root — mounting a provider per button would give each its own delay group
 * and lose the "already warmed up" behaviour when moving along a toolbar.
 */
export function IconButton({
  tooltip,
  tooltipSide = "top",
  size = "icon-sm",
  ...props
}: IconButtonProps) {
  const button = <Button size={size} {...props} />;
  if (tooltip === undefined) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
