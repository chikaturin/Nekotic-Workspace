import { stepNumberingOf } from "@/lib/step-numbering";
import type { BoardColumn, BoardColumnOf } from "@/types";

/**
 * Board Settings hiển thị được gì — suy ra từ SCHEMA của board, không từ tên nó.
 *
 * Lý do phải viết ở đây thay vì rải `if` trong component: "board này có Step
 * Numbering không" là một câu hỏi về dữ liệu, và câu trả lời phải giống nhau ở
 * mọi chỗ hỏi. Kiểm theo tên board (`name === "QA / QC"`) thì đổi tên board là
 * mất mục Settings — một cách hỏng vừa im lặng vừa vô lý với người dùng.
 */
export interface BoardCapabilities {
  /** Cột long-text đã bật đánh số bước. */
  readonly stepColumns: readonly BoardColumnOf<"longText">[];
  /** Cột select — nơi luật chuyển trạng thái sống. */
  readonly selectColumns: readonly BoardColumnOf<"select">[];
  /** Cột quan hệ, kèm board mà nó trỏ tới. */
  readonly relationColumns: readonly BoardColumnOf<"relation">[];
  readonly hasRules: boolean;
  readonly hasRelations: boolean;
}

const isLongText = (column: BoardColumn): column is BoardColumnOf<"longText"> =>
  column.type === "longText";

const isSelect = (column: BoardColumn): column is BoardColumnOf<"select"> =>
  column.type === "select";

const isRelation = (column: BoardColumn): column is BoardColumnOf<"relation"> =>
  column.type === "relation";

export function boardCapabilities(columns: readonly BoardColumn[]): BoardCapabilities {
  const stepColumns = columns
    .filter(isLongText)
    .filter((column) => stepNumberingOf(column.config).enabled);

  const selectColumns = columns.filter(isSelect);
  const relationColumns = columns.filter(isRelation);

  return {
    stepColumns,
    selectColumns,
    relationColumns,
    hasRules: stepColumns.length > 0 || selectColumns.length > 0,
    hasRelations: relationColumns.length > 0,
  };
}

export type BoardSettingsSection = "general" | "display" | "rules" | "columns" | "relations";

export interface SectionDescriptor {
  readonly id: BoardSettingsSection;
  readonly label: string;
}

/**
 * Mục nào có mặt trong drawer.
 *
 * General / Display / Columns luôn có — mọi board đều có tên, một view đang mở
 * và một bộ cột. Rules và Relations chỉ hiện khi schema thật sự có thứ để chỉnh,
 * nên Bug Board không mọc ra mục Step Numbering rỗng.
 */
export function settingsSections(capabilities: BoardCapabilities): readonly SectionDescriptor[] {
  return [
    { id: "general" as const, label: "General" },
    { id: "display" as const, label: "Display" },
    ...(capabilities.hasRules ? [{ id: "rules" as const, label: "Rules" }] : []),
    { id: "columns" as const, label: "Columns" },
    ...(capabilities.hasRelations ? [{ id: "relations" as const, label: "Relations" }] : []),
  ];
}
