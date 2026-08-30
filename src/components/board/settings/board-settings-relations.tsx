"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoardColumnOf } from "@/types";

interface BoardSettingsRelationsProps {
  readonly columns: readonly BoardColumnOf<"relation">[];
  readonly boardNames: Readonly<Record<string, string>>;
  readonly canEdit: boolean;
  readonly onOpen: (column: BoardColumnOf<"relation">) => void;
}

/**
 * Board này nối đi đâu.
 *
 * Chủ yếu để đọc: người dùng mở ra để hiểu "Related Bug" trỏ sang board nào,
 * chứ không phải để nối dữ liệu — nối dữ liệu là việc của từng ô trên bảng.
 */
export function BoardSettingsRelations({
  columns,
  boardNames,
  canEdit,
  onOpen,
}: BoardSettingsRelationsProps) {
  return (
    <ul className="space-y-2">
      {columns.map((column) => {
        const targetId = column.config.boardId;
        const target = targetId === null ? null : (boardNames[targetId] ?? null);

        return (
          <li
            key={column.id}
            className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-ui text-foreground">{column.name}</span>

            <ArrowRight className="size-3.5 shrink-0 text-faint-foreground" />

            <span className="shrink-0 text-ui text-muted-foreground">
              {target ?? (targetId === null ? "Not linked yet" : "Another board")}
            </span>

            <Badge variant="neutral">{column.config.isMulti ? "Multiple" : "Single"}</Badge>

            <Button size="sm" variant="outline" onClick={() => onOpen(column)}>
              {canEdit ? "Edit" : "View"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
