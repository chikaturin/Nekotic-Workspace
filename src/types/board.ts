import type { AppError } from "./async";
import type { DirectoryUser } from "./user";

export type ColumnType =
  | "text"
  | "longText"
  | "select"
  | "date"
  | "user"
  | "attachment"
  | "relation";

export type SelectColor = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "pink";

export type ConditionOperator =
  | "is"
  | "isNot"
  | "contains"
  | "notContains"
  | "isAnyOf"
  | "isNoneOf"
  | "before"
  | "after"
  | "on"
  | "isEmpty"
  | "isNotEmpty";

export interface Condition {
  readonly id: string;
  readonly columnId: string;
  readonly operator: ConditionOperator;
  readonly value: string;
  readonly values?: readonly string[];
}

export type ConditionConjunction = "and" | "or";

export interface ConditionGroup {
  readonly id: string;
  readonly conjunction: ConditionConjunction;
  readonly conditions: readonly Condition[];
  readonly groups: readonly ConditionGroup[];
}

export interface SelectOption {
  readonly id: string;
  readonly label: string;
  readonly color: SelectColor;
  readonly isDisabled?: boolean;
  readonly availability?: ConditionGroup | null;
}

export interface TransitionRules {
  readonly enabled: boolean;
  readonly mode: "allow-list";
  readonly transitions: Readonly<Record<string, readonly string[]>>;
}

export type UnavailableOptionBehavior = "disabled" | "hidden";

export interface TextConfig {
  readonly placeholder?: string;
}

export interface StepNumbering {
  readonly enabled: boolean;
  readonly prefix: string;
  readonly start: number;
  readonly separator: string;
}

export interface LongTextConfig {
  readonly rows: number;
  readonly stepNumbering?: StepNumbering;
}

export interface SelectConfig {
  readonly options: readonly SelectOption[];
  readonly isMulti: boolean;
  readonly unavailableBehavior?: UnavailableOptionBehavior;
  readonly completedOptionIds?: readonly string[];
  readonly transitionRules?: TransitionRules;
}

export interface DateConfig {
  readonly includesTime: boolean;
}

export interface UserConfig {
  readonly isMulti: boolean;
}

export interface AttachmentConfig {
  readonly maxFiles: number;
}

export interface RelationConfig {
  readonly boardId: string | null;
  readonly displayColumnId: string | null;
  readonly isMulti: boolean;
}

export interface ColumnConfigByType {
  readonly text: TextConfig;
  readonly longText: LongTextConfig;
  readonly select: SelectConfig;
  readonly date: DateConfig;
  readonly user: UserConfig;
  readonly attachment: AttachmentConfig;
  readonly relation: RelationConfig;
}

interface ColumnBase {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly width: number;
  readonly hidden: boolean;
  readonly isPrimary: boolean;
}

export type BoardColumnOf<T extends ColumnType> = ColumnBase & {
  readonly type: T;
  readonly config: ColumnConfigByType[T];
};

export type BoardColumn = { [T in ColumnType]: BoardColumnOf<T> }[ColumnType];

export interface CellAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly url: string | null;
  readonly thumbnailUrl: string | null;
  readonly uploadedBy?: string;
  readonly createdAt?: string;
}

export type CellValue =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "longText"; readonly value: string }
  | { readonly kind: "select"; readonly optionIds: readonly string[]; readonly text?: string }
  | { readonly kind: "date"; readonly iso: string | null; readonly text?: string }
  | { readonly kind: "user"; readonly userIds: readonly string[]; readonly text?: string }
  | {
      readonly kind: "attachment";
      readonly attachments: readonly CellAttachment[];
      readonly text?: string;
    }
  | { readonly kind: "relation"; readonly rowIds: readonly string[]; readonly text?: string };

export type CellValueOf<T extends ColumnType> = Extract<CellValue, { kind: T }>;

export interface BoardRow {
  readonly id: string;
  readonly boardId: string;
  readonly displayId: string;
  readonly sequence: number;
  readonly cells: Readonly<Record<string, CellValue>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly revision: number;
  readonly archivedAt?: string | null;
  readonly parentRowId?: string | null;
  readonly isPending?: boolean;
}

export type BoardViewType = "table" | "kanban" | "calendar" | "gantt";

export type GanttZoom = "week" | "month" | "quarter";

export type FilterOperator =
  | "isNotEmpty"
  | "isEmpty"
  | "contains"
  | "notContains"
  | "is"
  | "isNot"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter";

export interface ViewFilter {
  readonly id: string;
  readonly columnId: string;
  readonly operator: FilterOperator;
  readonly value: string;
}

export type FilterConjunction = "and" | "or";

export interface ViewSort {
  readonly columnId: string;
  readonly direction: "asc" | "desc";
}

export type CellDisplayMode = "compact" | "wrap" | "full";

export type RowHeight = "short" | "medium" | "tall";

export interface SavedView {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly type: BoardViewType;
  readonly filters: readonly ViewFilter[];
  readonly filterConjunction: FilterConjunction;
  readonly sorts: readonly ViewSort[];
  readonly hiddenColumnIds: readonly string[];
  readonly columnOrder: readonly string[];
  readonly columnWidths: Readonly<Record<string, number>>;
  readonly columnDisplay?: Readonly<Record<string, CellDisplayMode>>;
  readonly rowHeight: RowHeight;
  readonly groupByColumnId: string | null;
  readonly hideEmptyGroups: boolean;
  readonly dateColumnId: string | null;
  readonly endDateColumnId: string | null;
  readonly subtaskDisplay?: SubtaskDisplay;
  readonly ganttZoom?: GanttZoom;
  readonly showDependencies?: boolean;
}

export type SubtaskDisplay = "nested" | "flat" | "hidden";

export type BoardTemplateId = "task" | "bug" | "qa" | "apiDocs";

export interface TemplateView {
  readonly name: string;
  readonly type: BoardViewType;
  readonly groupByColumnId?: string;
  readonly dateColumnId?: string;
  readonly endDateColumnId?: string;
  readonly hiddenColumnIds?: readonly string[];
  readonly sorts?: readonly ViewSort[];
  readonly filters?: readonly ViewFilter[];
}

export interface BoardTemplate {
  readonly id: BoardTemplateId;
  readonly name: string;
  readonly description: string;
  readonly rowIdPrefix: string;
  readonly primaryColumnId: string;
  readonly columns: readonly BoardColumn[];
  readonly views: readonly TemplateView[];
}

export interface Board {
  readonly id: string;
  readonly templateId?: BoardTemplateId;
  readonly nodeId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly rowIdPrefix: string;
  readonly primaryColumnId: string;
  readonly columns: readonly BoardColumn[];
  readonly views: readonly SavedView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BoardSnapshot {
  readonly board: Board;
  readonly rows: readonly BoardRow[];
  readonly people: readonly DirectoryUser[];
  readonly nextCursor: string | null;
}

export interface CellEdit {
  readonly rowId: string;
  readonly columnId: string;
  readonly value: CellValue;
}

export interface ColumnPatch {
  readonly name?: string;
  readonly width?: number;
  readonly hidden?: boolean;
  readonly config?: Partial<ColumnConfigByType[ColumnType]>;
}

export interface ConversionPreview {
  readonly total: number;
  readonly converted: number;
  readonly preserved: number;
  readonly samples: readonly string[];
}

export interface ConflictNotice {
  readonly id: string;
  readonly rowId: string;
  readonly columnId: string;
  readonly message: string;
}

export type ActivityKind =
  | "created"
  | "updated"
  | "commented"
  | "attached"
  | "archived"
  | "restored"
  | "imported"
  | "moved";

export interface FieldChange {
  readonly columnName: string;
  readonly from: string;
  readonly to: string;
}

export interface ActivityEntry {
  readonly id: string;
  readonly rowId: string;
  readonly kind: ActivityKind;
  readonly actor: DirectoryUser;
  readonly summary: string;
  readonly changes: readonly FieldChange[];
  readonly createdAt: string;
}

export interface BoardError {
  readonly error: AppError;
}
