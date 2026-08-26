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
  readonly template: BoardTemplate;
  readonly seed: number;
  readonly index: number;
  readonly base: number;
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
  const { seed, index, base, template } = context;

  switch (column.type) {
    case "text":
      return { kind: "text", value: column.isPrimary ? primaryText(context) : "" };

    case "longText":
      return { kind: "longText", value: pick(DESCRIPTIONS, seed >> 13) };

    case "select": {
      const { options } = column.config;
      if (options.length === 0) return { kind: "select", optionIds: [] };

      // The API board's method comes from the endpoint catalogue, not the hash.
      if (template.id === "apiDocs" && column.id === "col_method") {
        const methodIndex = ENDPOINTS[index % ENDPOINTS.length]?.[1] ?? 0;
        return { kind: "select", optionIds: [options[methodIndex]?.id ?? options[0]!.id] };
      }

      return { kind: "select", optionIds: [pick(options, seed >> 5).id] };
    }

    case "user":
      return { kind: "user", userIds: seed % 9 === 0 ? [] : [pick(DIRECTORY, seed).id] };

    case "date": {
      const isEmpty = column.id === "col_start" ? seed % 5 === 0 : seed % 7 === 0;
      if (isEmpty) return { kind: "date", iso: null };

      const offset = column.id === "col_start" ? -((seed % 25) + 2) : (seed % 40) - 12;
      return { kind: "date", iso: new Date(base + offset * DAY_MS).toISOString() };
    }

    case "attachment":
      return { kind: "attachment", attachments: [] };

    case "relation":
      return { kind: "relation", rowIds: [] };
  }
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
    const context: RowContext = { template, seed, index, base };

    const cells: Record<string, CellValue> = {};
    for (const column of columns) cells[column.id] = cellFor(column, context);

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
