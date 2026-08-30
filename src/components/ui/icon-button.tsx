"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "aria-label"> {
  readonly "aria-label": string;
  readonly tooltip?: ReactNode;
  readonly tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
}

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
