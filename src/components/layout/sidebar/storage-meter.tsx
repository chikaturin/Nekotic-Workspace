"use client";

import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StorageQuota } from "@/types";

const WARNING_RATIO = 0.85;

interface StorageMeterProps {
  readonly storage: StorageQuota;
  readonly isCollapsed: boolean;
}

export function StorageMeter({ storage, isCollapsed }: StorageMeterProps) {
  const ratio = storage.totalBytes > 0 ? storage.usedBytes / storage.totalBytes : 0;
  const isWarning = ratio >= WARNING_RATIO;
  const label = `${formatBytes(storage.usedBytes)} of ${formatBytes(storage.totalBytes)} used`;

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-8 w-full items-center justify-center text-muted-foreground">
            <HardDrive className="size-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="px-1 py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-body font-medium text-muted-foreground">Storage</span>
        <span className={cn("metric text-micro", isWarning ? "text-warning" : "text-faint-foreground")}>
          {formatPercent(ratio)}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-hover">
        <motion.div
          className={cn("h-full rounded-full", isWarning ? "bg-warning" : "bg-accent")}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(ratio, 1) * 100}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="metric mt-1.5 text-micro text-faint-foreground">{label}</p>
    </div>
  );
}
