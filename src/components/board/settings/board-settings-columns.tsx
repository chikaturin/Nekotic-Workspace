"use client";

import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { useBoardStore } from "@/store/board-store";
import type { BoardColumn } from "@/types";

interface BoardSettingsColumnsProps {
  readonly columns: readonly BoardColumn[];
  readonly canEdit: boolean;
}

/**
 * Bảng kê schema, không phải trình soạn schema.
 *
 * Đổi kiểu cột, chuyển đổi dữ liệu, xoá cột đều đã sống trong menu ở đầu cột
 * trên bảng — chỗ mà người dùng đang nhìn thẳng vào dữ liệu bị ảnh hưởng. Nhân
 * bản chúng vào đây là tạo ra đường thứ hai làm cùng một việc, và hai đường đó
 * sẽ trôi khỏi nhau. Ở đây chỉ giữ thứ hợp lý khi nhìn TOÀN BỘ board: cột nào
 * đang ẩn.
 */
export function BoardSettingsColumns({ columns, canEdit }: BoardSettingsColumnsProps) {
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {columns.map((column) => (
        <li key={column.id} className="flex items-center gap-3 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-ui text-foreground">
            {column.name}
            {column.isPrimary && (
              <Badge variant="neutral" className="ml-2">
                Primary
              </Badge>
            )}
          </span>

          <span className="metric shrink-0 text-body text-faint-foreground">{column.type}</span>

          <IconButton
            size="icon-sm"
            variant="ghost"
            aria-label={`${column.hidden ? "Show" : "Hide"} ${column.name}`}
            disabled={!canEdit || column.isPrimary}
            onClick={() => void setColumnHidden(column.id, !column.hidden)}
          >
            {column.hidden ? <EyeOff /> : <Eye />}
          </IconButton>
        </li>
      ))}
    </ul>
  );
}
