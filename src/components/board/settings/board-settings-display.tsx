"use client";

import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useBoardStore } from "@/store/board-store";
import type { RowHeight, SubtaskDisplay } from "@/types";

interface BoardSettingsDisplayProps {
  readonly model: BoardViewModel;
  readonly canEdit: boolean;
}

const SUBTASKS: readonly { value: SubtaskDisplay; label: string }[] = [
  { value: "nested", label: "Nested under their parent" },
  { value: "flat", label: "Flat, alongside everything else" },
  { value: "hidden", label: "Hidden" },
];

const DENSITY: readonly { value: RowHeight; label: string }[] = [
  { value: "short", label: "Compact" },
  { value: "medium", label: "Comfortable" },
  { value: "tall", label: "Roomy" },
];

/**
 * Cách board HIỂN THỊ — và tất cả những thứ này thuộc về SAVED VIEW, không phải
 * board.
 *
 * Đó là lý do mục này không giữ state riêng mà gọi thẳng các action đã có
 * (`setSubtaskDisplay`, `setRowHeight`, `selectView`). Gom UI về một chỗ là
 * đúng; gom DỮ LIỆU về board object thì sai — hai người mở hai view khác nhau
 * của cùng board phải thấy hai cách bày khác nhau.
 */
export function BoardSettingsDisplay({ model, canEdit }: BoardSettingsDisplayProps) {
  const { board, view, subtaskDisplay } = model;

  const setActiveView = useBoardStore((state) => state.setActiveView);
  const setSubtaskDisplay = useBoardStore((state) => state.setSubtaskDisplay);
  const setRowHeight = useBoardStore((state) => state.setRowHeight);

  const views = board?.views ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="board-settings-view">Current view</Label>
        <Select
          id="board-settings-view"
          value={view?.id ?? null}
          isDisabled={views.length === 0}
          options={views.map((saved) => ({
            value: saved.id,
            label: `${saved.name} · ${saved.type}`,
          }))}
          onValueChange={(next) => next !== null && setActiveView(next)}
        />
        <p className="text-body text-faint-foreground">
          Everything below is saved on this view, so other views keep their own layout.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="board-settings-subtasks">Subtasks</Label>
        <Select
          id="board-settings-subtasks"
          value={subtaskDisplay}
          isDisabled={!canEdit}
          options={SUBTASKS.map((option) => ({ value: option.value, label: option.label }))}
          onValueChange={(next) =>
            next !== null && void setSubtaskDisplay(next as SubtaskDisplay)
          }
        />
      </div>

      {view?.type === "table" && (
        <div className="space-y-1.5">
          <Label htmlFor="board-settings-density">Row density</Label>
          <Select
            id="board-settings-density"
            value={view.rowHeight}
            isDisabled={!canEdit}
            options={DENSITY.map((option) => ({ value: option.value, label: option.label }))}
            onValueChange={(next) => next !== null && void setRowHeight(next as RowHeight)}
          />
        </div>
      )}
    </div>
  );
}
