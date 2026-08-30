"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldDescription, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface BoardSettingsGeneralProps {
  readonly name: string;
  readonly canEdit: boolean;
  readonly onRename: (name: string) => void;
  /** Báo ra ngoài để drawer biết có nên hỏi trước khi đóng hay không. */
  readonly onDirtyChange: (isDirty: boolean) => void;
}

/**
 * Đổi tên board.
 *
 * Không có bảng `boards.name`: tên board CHÍNH LÀ tên node trong cây drive. Nên
 * lưu ở đây đi qua đúng đường đổi tên node, và cây thư mục, breadcrumb, tìm
 * kiếm, Recent, Favorites cùng thấy tên mới — không phải vì component này đi
 * báo cho từng chỗ, mà vì tất cả đọc chung một nguồn.
 */
export function BoardSettingsGeneral({
  name,
  canEdit,
  onRename,
  onDirtyChange,
}: BoardSettingsGeneralProps) {
  const [draft, setDraft] = useState(name);

  const trimmed = draft.trim();
  const isDirty = trimmed !== name && trimmed.length > 0;

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="board-settings-name">Board name</Label>
        <Input
          id="board-settings-name"
          value={draft}
          disabled={!canEdit}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
        />
        <FieldDescription>
          This is the name shown in the sidebar, breadcrumbs and search.
        </FieldDescription>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!isDirty} onClick={() => onRename(trimmed)}>
            Save changes
          </Button>
          {isDirty && (
            <Button size="sm" variant="ghost" onClick={() => setDraft(name)}>
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
