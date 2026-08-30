"use client";

import { CalendarClock } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { SELECT_COLOR_CLASSES } from "@/lib/board-schema";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyWorkItem } from "@/types";

interface WorkItemRowProps {
  readonly item: MyWorkItem;
  readonly onOpen: (item: MyWorkItem) => void;
  readonly isOverdue?: boolean;
}

export function WorkItemRow({ item, onOpen, isOverdue = false }: WorkItemRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {item.displayId && (
            <Badge variant="default" className="shrink-0">
              {item.displayId}
            </Badge>
          )}
          <span className="min-w-0 flex-1 truncate text-lead text-foreground">{item.title}</span>
        </span>

        <span className="metric mt-0.5 flex flex-wrap items-center gap-1.5 text-micro text-faint-foreground">
          <span className="truncate">{item.boardName}</span>

          {item.statusLabel && (
            <span
              className={cn(
                "rounded-full border px-1.5 text-micro font-medium normal-case",
                item.statusColor
                  ? SELECT_COLOR_CLASSES[item.statusColor]
                  : "border-border text-muted-foreground",
              )}
            >
              {item.statusLabel}
            </span>
          )}

          {item.dueIso ? (
            <span className={cn("flex items-center gap-1", isOverdue && "text-danger")}>
              <CalendarClock className="size-3" />
              {formatDate(item.dueIso)}
            </span>
          ) : (
            <span>updated {formatRelativeTime(item.updatedAt)}</span>
          )}
        </span>
      </span>

      {item.assignees.length > 0 && (
        <span className="flex -space-x-1.5 pt-0.5">
          {item.assignees.slice(0, 3).map((person) => (
            <UserAvatar key={person.id} user={person} className="size-5" />
          ))}
        </span>
      )}
    </button>
  );
}
