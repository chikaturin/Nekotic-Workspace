import type { AppError } from "./async";
import type { DirectoryUser } from "./user";

/* ------------------------------------------------------------------ schema */

/** The seven cell types the table engine understands. */
export type ColumnType =
  | "text"
  | "longText"
  | "select"
  | "date"
  | "user"
  | "attachment"
  | "relation";

export type SelectColor = "gray" | "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "pink";

/* --------------------------------------------------------------- conditions */

/**
 * Operators a rule can test a cell with. Deliberately a superset of
 * `FilterOperator`: the same vocabulary drives view filters, conditional
 * select options and anything rule-based that lands later.
 */
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

/**
 * One test against one column of the record being evaluated.
 *
 * `value` is read the way the column reads it: an option id for select, a user
 * id for user, `YYYY-MM-DD` for date, free text otherwise. `values` carries the
 * list for the set operators; single-value operators ignore it.
 */
export interface Condition {
  readonly id: string;
  readonly columnId: string;
  readonly operator: ConditionOperator;
  readonly value: string;
  readonly values?: readonly string[];
}

export type ConditionConjunction = "and" | "or";

/**
 * Conditions plus nested groups, combined by one conjunction. Nesting is what
 * makes `A and (B or C)` expressible without a second data shape.
 */
export interface ConditionGroup {
  readonly id: string;
  readonly conjunction: ConditionConjunction;
  readonly conditions: readonly Condition[];
  readonly groups: readonly ConditionGroup[];
}

/* ------------------------------------------------------------------ select */

export interface SelectOption {
  readonly id: string;
  readonly label: string;
  readonly color: SelectColor;
  /** Switched off in column settings — never selectable, whatever a record holds. */
  readonly isDisabled?: boolean;
  /**
   * Extra gate: the option is only offered while this evaluates true against
   * the record being edited. Null or absent means "always offered".
   */
  readonly availability?: ConditionGroup | null;
}

/**
 * What a Kanban drag (or a status edit) is allowed to do.
 *
 * The rules are data, keyed by option id, and authored by the user — nothing
 * in the codebase knows that "debug" may not reach "done". `transitions` maps
 * a source option id to the option ids it may move to; `EMPTY_OPTION_KEY`
 * stands for the empty bucket on both sides.
 */
export interface TransitionRules {
  readonly enabled: boolean;
  /** Only declared transitions pass. Left open for a future deny-list. */
  readonly mode: "allow-list";
  readonly transitions: Readonly<Record<string, readonly string[]>>;
}

/** What the dropdown does with an option whose conditions do not hold. */
export type UnavailableOptionBehavior = "disabled" | "hidden";

export interface TextConfig {
  readonly placeholder?: string;
}

/**
 * Turning a long-text column into a list of numbered steps.
 *
 * A QA case is written as `B1: …`, `B2: …`; a test plan as `T1:`, `T2:`. The
 * shape is always the same — a prefix, a number, a separator — so it is three
 * fields rather than a template language. Behaviour rather than presentation,
 * so it belongs to the column and everyone reading the board gets it.
 */
export interface StepNumbering {
  readonly enabled: boolean;
  /** Letters in front of the number, e.g. `B`, `T`, `Step `. May be empty. */
  readonly prefix: string;
  /** The number the first step takes. */
  readonly start: number;
  /** What follows the number, e.g. `:` or `.`. */
  readonly separator: string;
}

export interface LongTextConfig {
  /** Preferred editor height in text rows. */
  readonly rows: number;
  readonly stepNumbering?: StepNumbering;
}

export interface SelectConfig {
  readonly options: readonly SelectOption[];
  readonly isMulti: boolean;
  /** Hide or merely disable options the record does not qualify for. */
  readonly unavailableBehavior?: UnavailableOptionBehavior;
  /**
   * Options that mean "finished". Subtask progress counts against these, so
   * completion is configured rather than inferred from a label.
   */
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

/**
 * Relation is wired for the module that lands later: the column already points
 * at a target board and the column whose value labels each chip.
 */
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
  /** The one column that titles a row. It can never be hidden or deleted. */
  readonly isPrimary: boolean;
}

export type BoardColumnOf<T extends ColumnType> = ColumnBase & {
  readonly type: T;
  readonly config: ColumnConfigByType[T];
};

export type BoardColumn = { [T in ColumnType]: BoardColumnOf<T> }[ColumnType];

/* ------------------------------------------------------------------ values */

/**
 * A file attached to a record.
 *
 * The board holds a *reference*, never the bytes: `url` points at the stored
 * asset (a signed URL in production), so a record with twenty screenshots
 * costs twenty small objects in memory rather than twenty base64 blobs.
 *
 * Attachments belong to the record, not to the Drive tree — uploading one into
 * a task does not create a file node beside the board.
 */
export interface CellAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Session URL for the real bytes; null once the session that made it ends. */
  readonly url: string | null;
  readonly thumbnailUrl: string | null;
  /** Directory id of whoever uploaded it. */
  readonly uploadedBy?: string;
  readonly createdAt?: string;
}

/**
 * Cell values are tagged with their own kind rather than inferred from the
 * column. A converted column can therefore keep the text it could not parse
 * (`text` on a date or select cell) instead of dropping the user's data.
 */
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

/* -------------------------------------------------------------------- rows */

export interface BoardRow {
  /** Server identity. Optimistic rows carry a `tmp_` id until the API answers. */
  readonly id: string;
  readonly boardId: string;
  /** `TASK-001` — assigned by the backend, never derived on the client. */
  readonly displayId: string;
  /** Numeric part of the display id; monotonic per board, never reused. */
  readonly sequence: number;
  readonly cells: Readonly<Record<string, CellValue>>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  /** Bumped by the server on every write — the optimistic-concurrency token. */
  readonly revision: number;
  /**
   * When the record was archived (SY-ARC-37). Archived records are hidden from
   * every view by default and are read-only until they are restored.
   */
  readonly archivedAt?: string | null;
  /**
   * Parent record in the task hierarchy, or null/absent at the top level.
   *
   * A subtask is a full board record — its own display id, status, assignee,
   * attachments, comments and history — so the parent stores a pointer, never
   * a nested copy. Nothing here caps the depth: a subtask may itself be a
   * parent, and the hierarchy helpers walk as far as the data goes.
   */
  readonly parentRowId?: string | null;
  /** True while the row exists only optimistically. */
  readonly isPending?: boolean;
}

/* ------------------------------------------------------------------- views */

export type BoardViewType = "table" | "kanban" | "calendar" | "gantt";

/**
 * How wide a day is drawn. Week reads a sprint, quarter reads a year — the
 * unit is always a whole day, only its pixel width changes.
 *
 * A per-day scale used to sit below Week and was removed: at 44px a day, a
 * fortnight filled the viewport and reading a plan meant scrolling it, which
 * is the one thing a roadmap exists to avoid. Week is the floor, and a saved
 * view still holding `"day"` is read as Week rather than crashing — see
 * `normalizeGanttZoom`.
 */
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

/**
 * One condition. `value` is interpreted by the column's type: an option id or
 * label for select, a user id or name for user, `YYYY-MM-DD` for date, free
 * text otherwise.
 */
export interface ViewFilter {
  readonly id: string;
  readonly columnId: string;
  readonly operator: FilterOperator;
  readonly value: string;
}

/** How the conditions combine — "all of" or "any of". */
export type FilterConjunction = "and" | "or";

export interface ViewSort {
  readonly columnId: string;
  readonly direction: "asc" | "desc";
}

/**
 * How much of a cell's content a view shows.
 *
 *   - `compact` — one line, clipped. Every row is the same height.
 *   - `wrap`    — wraps to a few lines, then clips. Rows grow, within a bound.
 *   - `full`    — the whole value, however many lines that takes.
 *
 * Rows stay uniform under `compact`, which is the default and what the grid
 * has always done; the other two are what make a QA step readable in place.
 */
export type CellDisplayMode = "compact" | "wrap" | "full";

export type RowHeight = "short" | "medium" | "tall";

/**
 * Presentation only. Records and schema live on the board, so switching views
 * never copies data — a view just describes how to read it.
 */
export interface SavedView {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly type: BoardViewType;
  readonly filters: readonly ViewFilter[];
  readonly filterConjunction: FilterConjunction;
  /** Multi-level: earlier entries win, later ones break ties. */
  readonly sorts: readonly ViewSort[];
  readonly hiddenColumnIds: readonly string[];
  /** Per-view column order; ids missing from it fall back to schema position. */
  readonly columnOrder: readonly string[];
  readonly columnWidths: Readonly<Record<string, number>>;
  /**
   * Per-column display mode. Presentation, so it sits beside `columnWidths`
   * rather than on the schema: one saved view can read Step in full while
   * another keeps it to a line, without either changing what the column *is*.
   * A column missing from the map is `compact`.
   */
  readonly columnDisplay?: Readonly<Record<string, CellDisplayMode>>;
  readonly rowHeight: RowHeight;
  /** Grouping column for the table and Kanban. */
  readonly groupByColumnId: string | null;
  /** Drop groups that hold no records instead of showing an empty one. */
  readonly hideEmptyGroups: boolean;
  /** Calendar and timeline anchor on these date columns. */
  readonly dateColumnId: string | null;
  readonly endDateColumnId: string | null;
  /**
   * How this view treats the parent/child hierarchy. Per view, so one saved
   * view can nest subtasks while another lists every record flat.
   */
  readonly subtaskDisplay?: SubtaskDisplay;
  /** Gantt's time scale. Presentation, so it belongs to the view. */
  readonly ganttZoom?: GanttZoom;
  /** Draw the "blocked by" connectors. Off is a legitimate way to read a plan. */
  readonly showDependencies?: boolean;
}

/**
 * `nested` — children indent under their parent, collapsible.
 * `flat`   — every record is a top-level row (the pre-hierarchy behaviour).
 * `hidden` — subtasks are dropped from the view entirely.
 */
export type SubtaskDisplay = "nested" | "flat" | "hidden";

/* --------------------------------------------------------------- templates */

export type BoardTemplateId = "task" | "bug" | "qa" | "apiDocs";

/** A view as a template declares it — ids are minted when it is instantiated. */
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

/**
 * A board blueprint. Templates are read-only data: instantiating one deep-copies
 * its schema, so editing the board it produced can never reach back.
 */
export interface BoardTemplate {
  readonly id: BoardTemplateId;
  readonly name: string;
  readonly description: string;
  readonly rowIdPrefix: string;
  readonly primaryColumnId: string;
  readonly columns: readonly BoardColumn[];
  readonly views: readonly TemplateView[];
}

/* ------------------------------------------------------------------- board */

export interface Board {
  readonly id: string;
  /** Template the board was generated from, for reference only. */
  readonly templateId?: BoardTemplateId;
  /** Drive node the board is addressed by. */
  readonly nodeId: string;
  readonly workspaceId: string;
  readonly name: string;
  /** `TASK`, `BUG`, `QA` — the row id prefix configured for this board. */
  readonly rowIdPrefix: string;
  readonly primaryColumnId: string;
  readonly columns: readonly BoardColumn[];
  readonly views: readonly SavedView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Everything one board needs before its first paint. */
export interface BoardSnapshot {
  readonly board: Board;
  readonly rows: readonly BoardRow[];
  readonly people: readonly DirectoryUser[];
  /** Null when the whole record set arrived in one page. */
  readonly nextCursor: string | null;
}

/* --------------------------------------------------------------- mutations */

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

/** What a conversion would do, shown before the user commits to it. */
export interface ConversionPreview {
  readonly total: number;
  readonly converted: number;
  /** Values kept as text with a warning because they could not be parsed. */
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

/**
 * One field that changed, already rendered to the text the column displays.
 * The timeline reads these — it never sees, and never renders, a raw payload.
 */
export interface FieldChange {
  readonly columnName: string;
  readonly from: string;
  readonly to: string;
}

/**
 * One entry in a record's history.
 *
 * A single write produces a single entry however many fields it touched, so
 * "changed Status and Due Date" is one line in the timeline with two changes
 * under it rather than two competing lines at the same second.
 */
export interface ActivityEntry {
  readonly id: string;
  readonly rowId: string;
  readonly kind: ActivityKind;
  readonly actor: DirectoryUser;
  /** Human sentence fragment: `changed Status`, `created TASK-001`. */
  readonly summary: string;
  readonly changes: readonly FieldChange[];
  readonly createdAt: string;
}

export interface BoardError {
  readonly error: AppError;
}
