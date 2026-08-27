import { MOCK_NOW } from "@/config/app";
import { instantiateColumns, templateById, BOARD_TEMPLATES } from "@/lib/board-templates";
import { formatRowId } from "@/lib/row-id";
import { DIRECTORY } from "@/mock/users";
import type {
  Board,
  BoardColumn,
  BoardRow,
  BoardTemplate,
  BoardViewType,
  CellValue,
  SavedView,
} from "@/types";

/**
 * Board fixtures, generated from the template catalogue.
 *
 * Everything is derived from the node id and the row index, so the dataset is
 * identical on every reload and in every test.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Date columns that open a range; every other date column closes one.
 *
 * The templates pair these as a Gantt view's start and end — `col_start` with
 * `col_due`, `col_found` with `col_target`, and so on — so generating them as
 * a pair is what keeps the fixtures schedulable.
 */
const RANGE_START_COLUMNS: ReadonlySet<string> = new Set([
  "col_start",
  "col_found",
  "col_planned",
  "col_documented",
]);

/** Relation columns that point at another record on the same board. */
const BLOCKING_COLUMNS: ReadonlySet<string> = new Set(["col_blocks"]);

function hash(seed: string): number {
  let value = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16_777_619);
  }
  return Math.abs(value);
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length] ?? items[0]!;
}

/* -------------------------------------------------------------- templates */

/** A board declares its template; older fixtures infer one from their name. */
export function templateForBoard(name: string, templateId?: string): BoardTemplate {
  const declared = templateById(templateId);
  if (declared) return declared;

  const lower = name.toLowerCase();
  if (lower.includes("api")) return templateById("apiDocs")!;
  if (lower.includes("bug")) return templateById("bug")!;
  if (lower.includes("qa") || lower.includes("regression") || lower.includes("checklist")) {
    return templateById("qa")!;
  }

  return templateById("task")!;
}

export function prefixForBoard(name: string, templateId?: string): string {
  return templateForBoard(name, templateId).rowIdPrefix;
}

function viewsFor(
  boardId: string,
  template: BoardTemplate,
  primaryKind: BoardViewType,
): readonly SavedView[] {
  const views = template.views.map<SavedView>((definition, index) => ({
    id: `${boardId}_view_${index}`,
    boardId,
    name: definition.name,
    type: definition.type,
    filters: definition.filters ?? [],
    filterConjunction: "and",
    sorts: definition.sorts ?? [],
    hiddenColumnIds: definition.hiddenColumnIds ?? [],
    columnOrder: [],
    columnWidths: {},
    rowHeight: "medium",
    groupByColumnId: definition.groupByColumnId ?? null,
    hideEmptyGroups: false,
    dateColumnId: definition.dateColumnId ?? null,
    endDateColumnId: definition.endDateColumnId ?? null,
  }));

  // The node's own kind decides which saved view opens first.
  const lead = views.findIndex((view) => view.type === primaryKind);
  if (lead <= 0) return views;

  return [views[lead]!, ...views.filter((_, index) => index !== lead)];
}

/* ------------------------------------------------------------------- rows */

const TITLE_VERBS = [
  "Fix",
  "Investigate",
  "Refactor",
  "Document",
  "Ship",
  "Harden",
  "Migrate",
  "Instrument",
  "Review",
  "Automate",
];

const TITLE_SUBJECTS = [
  "webhook retries",
  "refund reconciliation",
  "idempotency keys",
  "payout ledger",
  "3DS challenge flow",
  "settlement export",
  "provider failover",
  "rate limiter",
  "audit trail",
  "checkout session",
  "invoice renderer",
  "fraud scoring",
];

const QA_CASES = [
  "Login with an expired token",
  "Refund a partially captured charge",
  "Retry a webhook after a 500",
  "Export settlements for a closed period",
  "Switch provider mid-checkout",
  "Upload evidence larger than 25 MB",
];

/**
 * Endpoint catalogue for the API documentation board. Two entries repeat the
 * same endpoint and method on purpose, so the duplicate warning has something
 * real to find.
 */
const ENDPOINTS: readonly (readonly [string, number])[] = [
  ["/auth/login", 1],
  ["/auth/refresh", 1],
  ["/auth/logout", 1],
  ["/payments", 0],
  ["/payments", 1],
  ["/payments/:id", 0],
  ["/payments/:id/refund", 1],
  ["/payments/:id", 2],
  ["/payments/:id", 4],
  ["/webhooks/stripe", 1],
  ["/webhooks/vnpay", 1],
  ["/settlements", 0],
  ["/settlements/export", 1],
  ["/customers", 0],
  ["/customers", 1],
  ["/customers/:id", 3],
  ["/auth/login", 1],
  ["/payments/:id/refund", 1],
];

const DESCRIPTIONS = [
  "Reproduced on staging with the sandbox provider. Needs a decision on the retry budget before it can ship.",
  "Blocked on the provider's sandbox limits. Retest once the quota resets.",
  "Follow-up from the incident review. Add the metric first, then the alert.",
  "",
];

interface RowContext {
  readonly boardId: string;
  readonly template: BoardTemplate;
  /** Row-level hash — drives the title, the author and the timestamps. */
  readonly seed: number;
  readonly index: number;
  readonly base: number;
  /**
   * Per-column hash. Deriving every cell from the row hash alone correlates
   * the columns: with a 7-person directory and a 7-way test on any other
   * field, the records assigned to one person were exactly the records that
   * failed it.
   */
  readonly cellSeed: number;
}

function primaryText({ template, seed, index }: RowContext): string {
  if (template.id === "apiDocs") {
    return ENDPOINTS[index % ENDPOINTS.length]?.[0] ?? "/";
  }
  if (template.id === "qa") {
    return pick(QA_CASES, seed);
  }

  return `${pick(TITLE_VERBS, seed)} ${pick(TITLE_SUBJECTS, seed >> 3)}`;
}

function cellFor(column: BoardColumn, context: RowContext): CellValue {
  const { boardId, cellSeed, index, base, template } = context;

  switch (column.type) {
    case "text":
      return { kind: "text", value: column.isPrimary ? primaryText(context) : "" };

    case "longText":
      return { kind: "longText", value: pick(DESCRIPTIONS, cellSeed) };

    case "select": {
      const { options } = column.config;
      if (options.length === 0) return { kind: "select", optionIds: [] };

      // The API board's method comes from the endpoint catalogue, not the hash.
      if (template.id === "apiDocs" && column.id === "col_method") {
        const methodIndex = ENDPOINTS[index % ENDPOINTS.length]?.[1] ?? 0;
        return { kind: "select", optionIds: [options[methodIndex]?.id ?? options[0]!.id] };
      }

      return { kind: "select", optionIds: [pick(options, cellSeed).id] };
    }

    case "user":
      return {
        kind: "user",
        userIds: cellSeed % 9 === 0 ? [] : [pick(DIRECTORY, cellSeed).id],
      };

    case "date": {
      /**
       * Both ends of a range are always generated, and the end is measured
       * *from* the start rather than hashed on its own. Two independent days
       * produced records whose start fell after their end, and records with
       * only one of the two — neither of which is a duration, so the Gantt
       * could place neither, and a chart of a full board came up mostly empty.
       */
      const start = -((cellSeed % 25) + 2);
      if (RANGE_START_COLUMNS.has(column.id)) {
        return { kind: "date", iso: new Date(base + start * DAY_MS).toISOString() };
      }

      // Every ninth deadline lands on the reference day, so "Due today" and
      // the calendar both have something real to show. It is still after the
      // start, which is always at least two days in the past.
      const offset = cellSeed % 9 === 0 ? 0 : start + (cellSeed % 14) + 1;

      return { kind: "date", iso: new Date(base + offset * DAY_MS).toISOString() };
    }

    case "attachment":
      return { kind: "attachment", attachments: [] };

    case "relation": {
      /**
       * "Blocked by" is the one relation that points inside the same board, so
       * it is the only one seeded. The others name a record on another board,
       * whose ids this generator has no business inventing.
       *
       * Every fourth record is blocked by one a little ahead of it, which gives
       * the Gantt real connectors to draw and its conflict warning something to
       * find — an empty relation column made the dependency toggle look broken.
       */
      if (!BLOCKING_COLUMNS.has(column.id) || cellSeed % 4 !== 0) {
        return { kind: "relation", rowIds: [] };
      }

      const blockerIndex = index - ((cellSeed % 3) + 1);
      if (blockerIndex < 0) return { kind: "relation", rowIds: [] };

      return { kind: "relation", rowIds: [`${boardId}_row_${blockerIndex + 1}`] };
    }
  }
}

/**
 * Which fixture rows are subtasks, and of what.
 *
 * A repeating shape — one parent followed by three children, every seventh
 * record — so the dataset always contains a hierarchy to look at, identically
 * on every reload. Only work boards get one: an endpoint catalogue has no
 * notion of a subtask.
 */
const HIERARCHY_TEMPLATES = new Set<BoardTemplate["id"]>(["task", "bug"]);
const HIERARCHY_PERIOD = 7;

function parentIndexFor(template: BoardTemplate, index: number): number | null {
  if (!HIERARCHY_TEMPLATES.has(template.id)) return null;

  const slot = index % HIERARCHY_PERIOD;
  // Slot 1 is a parent; slots 2–4 are its children.
  return slot >= 2 && slot <= 4 ? index - (slot - 1) : null;
}

export function buildRows(
  boardId: string,
  template: BoardTemplate,
  columns: readonly BoardColumn[],
  count: number,
): readonly BoardRow[] {
  const rows: BoardRow[] = [];
  const base = Date.parse(MOCK_NOW);

  for (let index = 0; index < count; index += 1) {
    const seed = hash(`${boardId}:${index}`);
    const sequence = index + 1;
    const person = pick(DIRECTORY, seed);

    const cells: Record<string, CellValue> = {};
    for (const column of columns) {
      const cellSeed = hash(`${boardId}:${index}:${column.id}`);
      cells[column.id] = cellFor(column, { boardId, template, seed, cellSeed, index, base });
    }

    const parentIndex = parentIndexFor(template, index);

    rows.push({
      id: `${boardId}_row_${sequence}`,
      boardId,
      displayId: formatRowId(template.rowIdPrefix, sequence),
      sequence,
      cells,
      createdAt: new Date(base - ((seed % 90) + 1) * DAY_MS).toISOString(),
      updatedAt: new Date(base - (seed % 20) * DAY_MS).toISOString(),
      createdBy: person.id,
      revision: 1,
      // The child points at the parent; the parent stores nothing about it.
      ...(parentIndex !== null && parentIndex < index
        ? { parentRowId: `${boardId}_row_${parentIndex + 1}` }
        : {}),
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ board */

export interface BoardSeed {
  readonly nodeId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly kind: BoardViewType;
  readonly rowCount: number;
  readonly templateId?: string;
}

export function buildBoard(seed: BoardSeed): { board: Board; rows: readonly BoardRow[] } {
  const boardId = `brd_${seed.nodeId}`;
  const template = templateForBoard(seed.name, seed.templateId);
  const columns = instantiateColumns(template);

  const board: Board = {
    id: boardId,
    templateId: template.id,
    nodeId: seed.nodeId,
    workspaceId: seed.workspaceId,
    name: seed.name,
    rowIdPrefix: template.rowIdPrefix,
    primaryColumnId: template.primaryColumnId,
    columns,
    views: viewsFor(boardId, template, seed.kind),
    createdAt: MOCK_NOW,
    updatedAt: MOCK_NOW,
  };

  return { board, rows: buildRows(boardId, template, columns, seed.rowCount) };
}

export { BOARD_TEMPLATES };
