"use client";

import { ListOrdered, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transitionRulesOf } from "@/lib/transition-rules";
import { stepNumberingOf } from "@/lib/step-numbering";
import type { BoardCapabilities } from "@/lib/board-settings";
import type { BoardColumnOf } from "@/types";

interface BoardSettingsRulesProps {
  readonly capabilities: BoardCapabilities;
  readonly canEdit: boolean;
  readonly onOpenSteps: (column: BoardColumnOf<"longText">) => void;
  readonly onOpenSelect: (column: BoardColumnOf<"select">) => void;
}

/**
 * Điểm VÀO cho các luật, không phải nơi chứa chúng.
 *
 * Luật đánh số bước sống trong config của cột, luật chuyển trạng thái sống
 * trong config của cột select. Nhân bản form vào đây sẽ đẻ ra trạng thái thứ
 * hai rồi trôi khỏi bản gốc — nên mục này chỉ tóm tắt luật đang có và mở đúng
 * hộp thoại đã tồn tại. Nguồn sự thật vẫn là cột.
 */
export function BoardSettingsRules({
  capabilities,
  canEdit,
  onOpenSteps,
  onOpenSelect,
}: BoardSettingsRulesProps) {
  const { stepColumns, selectColumns } = capabilities;

  return (
    <div className="space-y-5">
      {stepColumns.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-ui font-medium text-foreground">
            <ListOrdered className="size-4 text-faint-foreground" />
            Step numbering
          </h3>

          {stepColumns.map((column) => {
            const steps = stepNumberingOf(column.config);

            return (
              <div
                key={column.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                  {column.name}
                </span>
                <span className="metric shrink-0 text-body text-faint-foreground">
                  {`${steps.prefix}${steps.start}${steps.separator.trim()}`}
                </span>
                <Button size="sm" variant="outline" onClick={() => onOpenSteps(column)}>
                  {canEdit ? "Edit" : "View"}
                </Button>
              </div>
            );
          })}
        </section>
      )}

      {selectColumns.length > 0 && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-ui font-medium text-foreground">
            <Workflow className="size-4 text-faint-foreground" />
            Status transitions
          </h3>

          {selectColumns.map((column) => {
            const rules = transitionRulesOf(column);
            const governed = Object.keys(rules).length;

            return (
              <div
                key={column.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                  {column.name}
                </span>
                <span className="shrink-0 text-body text-faint-foreground">
                  {governed === 0
                    ? "Any status can follow any other"
                    : `${governed} of ${column.config.options.length} governed`}
                </span>
                <Button size="sm" variant="outline" onClick={() => onOpenSelect(column)}>
                  {canEdit ? "Edit" : "View"}
                </Button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
