import { DEFAULT_COLUMN_WIDTH, makeColumn, PRIMARY_COLUMN_WIDTH } from "@/lib/board-schema";
import type {
  BoardColumn,
  BoardTemplate,
  BoardTemplateId,
  ConditionGroup,
  SelectOption,
  ColumnType,
  TransitionRules,
} from "@/types";

/**
 * Board blueprints.
 *
 * A template is inert data: `instantiateTemplate` deep-copies everything it
 * hands out, so a board can add, rename or delete columns without the template
 * it came from ever changing — the acceptance criterion for DV-TMP-19.
 */

function options(values: readonly (readonly [string, SelectOption["color"]])[], prefix: string) {
  return values.map(([label, color], index) => ({ id: `${prefix}_${index}`, label, color }));
}

/**
 * The three deployment labels, defined once (DV-ENV-21). Bug, QA, API and the
 * config document all point at this list rather than re-declaring it.
 */
export const ENVIRONMENT_OPTIONS: readonly SelectOption[] = options(
  [
    ["Development", "cyan"],
    ["Staging", "amber"],
    ["Production", "red"],
  ],
  "env",
);

export const PRODUCTION_OPTION_ID = "env_2";

/** HTTP verbs carry their own colour so a method reads at a glance. */
export const METHOD_OPTIONS: readonly SelectOption[] = options(
  [
    ["GET", "green"],
    ["POST", "blue"],
    ["PUT", "amber"],
    ["PATCH", "violet"],
    ["DELETE", "red"],
  ],
  "method",
);

/* ------------------------------------------------------------- builders */

interface ColumnSpec {
  readonly id: string;
  readonly name: string;
  readonly type: ColumnType;
  readonly width?: number;
  readonly isPrimary?: boolean;
  readonly options?: readonly SelectOption[];
  readonly isMulti?: boolean;
  readonly includesTime?: boolean;
  /**
   * Which options mean "finished". Subtask progress is measured against these,
   * so completion is a setting on the board rather than a label match in code.
   */
  readonly completedOptionIds?: readonly string[];
  /** Seed rules the user can then edit, disable or replace entirely. */
  readonly transitionRules?: TransitionRules;
}

function column(spec: ColumnSpec, position: number): BoardColumn {
  const base = makeColumn(spec.id, spec.name, spec.type, position, {
    width: spec.width ?? (spec.isPrimary ? PRIMARY_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH),
    ...(spec.isPrimary ? { isPrimary: true } : {}),
  });

  if (spec.type === "select") {
    return {
      ...base,
      type: "select",
      config: {
        options: spec.options ?? [],
        isMulti: false,
        unavailableBehavior: "disabled",
        ...(spec.completedOptionIds ? { completedOptionIds: spec.completedOptionIds } : {}),
        ...(spec.transitionRules ? { transitionRules: spec.transitionRules } : {}),
      },
    };
  }
  if (spec.type === "user") {
    return { ...base, type: "user", config: { isMulti: spec.isMulti ?? false } };
  }
  if (spec.type === "date") {
    return { ...base, type: "date", config: { includesTime: spec.includesTime ?? false } };
  }

  return base;
}

function schema(specs: readonly ColumnSpec[]): readonly BoardColumn[] {
  return specs.map(column);
}

/**
 * A transition table, written as "from → allowed targets".
 *
 * Templates ship a sensible starting graph; it is ordinary configuration from
 * the moment the board exists, and the user can rewrite or switch it off. No
 * code path anywhere depends on the pairs declared here.
 */
function transitions(
  table: Readonly<Record<string, readonly string[]>>,
  enabled = false,
): TransitionRules {
  return { enabled, mode: "allow-list", transitions: table };
}

/** `Field is empty` — the one condition the seeded rules need. */
function whenEmpty(id: string, columnId: string): ConditionGroup {
  return {
    id,
    conjunction: "and",
    conditions: [{ id: `${id}_c0`, columnId, operator: "isEmpty", value: "" }],
    groups: [],
  };
}

/* ------------------------------------------------------------ templates */

const TASK: BoardTemplate = {
  id: "task",
  name: "Task board",
  description: "Sprint work with status, priority, owner and dates.",
  rowIdPrefix: "TASK",
  primaryColumnId: "col_title",
  columns: schema([
    { id: "col_title", name: "Title", type: "text", isPrimary: true },
    {
      id: "col_status",
      name: "Status",
      type: "select",
      width: 150,
      // "Done" is only offered while nothing is blocking the record. The rule
      // is data on the option, editable under Options & rules — the Select
      // component itself knows nothing about blocking.
      options: options(
        [
          ["To do", "gray"],
          ["In progress", "blue"],
          ["In review", "violet"],
          ["Blocked", "red"],
          ["Done", "green"],
        ],
        "status",
      ).map((option) =>
        option.id === "status_4"
          ? { ...option, availability: whenEmpty("status_4_rule", "col_blocks") }
          : option,
      ),
      completedOptionIds: ["status_4"],
      // Off by default: a board should behave exactly as it always has until
      // someone opts into the rules.
      transitionRules: transitions({
        status_0: ["status_1", "status_3"],
        status_1: ["status_2", "status_3", "status_0"],
        status_2: ["status_1", "status_4"],
        status_3: ["status_0", "status_1"],
        status_4: ["status_1"],
        __empty__: ["status_0"],
      }),
    },
    {
      id: "col_priority",
      name: "Priority",
      type: "select",
      width: 130,
      options: options(
        [
          ["Urgent", "red"],
          ["High", "amber"],
          ["Medium", "blue"],
          ["Low", "gray"],
        ],
        "priority",
      ),
    },
    { id: "col_assignee", name: "Assignee", type: "user", width: 190 },
    { id: "col_due", name: "Due date", type: "date", width: 150 },
    { id: "col_start", name: "Start date", type: "date", width: 150 },
    { id: "col_description", name: "Description", type: "longText", width: 260 },
    { id: "col_evidence", name: "Attachments", type: "attachment", width: 180 },
    { id: "col_blocks", name: "Blocked by", type: "relation" },
  ]),
  views: [
    { name: "All records", type: "table" },
    { name: "Board", type: "kanban", groupByColumnId: "col_status" },
    { name: "Schedule", type: "calendar", dateColumnId: "col_due" },
    {
      name: "Roadmap",
      type: "timeline",
      dateColumnId: "col_start",
      endDateColumnId: "col_due",
    },
  ],
};

const BUG: BoardTemplate = {
  id: "bug",
  name: "Bug board",
  description: "Defects with severity, environment and reproduction evidence.",
  rowIdPrefix: "BUG",
  primaryColumnId: "col_title",
  columns: schema([
    { id: "col_title", name: "Summary", type: "text", isPrimary: true },
    {
      id: "col_severity",
      name: "Severity",
      type: "select",
      width: 140,
      options: options(
        [
          ["Critical", "red"],
          ["Major", "amber"],
          ["Minor", "blue"],
          ["Trivial", "gray"],
        ],
        "sev",
      ),
    },
    {
      id: "col_status",
      name: "Status",
      type: "select",
      width: 150,
      options: options(
        [
          ["New", "gray"],
          ["Triaged", "violet"],
          ["In progress", "blue"],
          ["Fixed", "cyan"],
          ["Verified", "green"],
          ["Won't fix", "pink"],
        ],
        "status",
      ),
      completedOptionIds: ["status_4", "status_5"],
      // A defect walks the ladder: nothing jumps from New straight to
      // Verified. Seeded, disabled, and entirely the user's to change.
      transitionRules: transitions({
        status_0: ["status_1", "status_5"],
        status_1: ["status_2", "status_5"],
        status_2: ["status_3", "status_1"],
        status_3: ["status_4", "status_2"],
        status_4: ["status_2"],
        status_5: ["status_1"],
        __empty__: ["status_0"],
      }),
    },
    { id: "col_env", name: "Environment", type: "select", width: 150, options: ENVIRONMENT_OPTIONS },
    { id: "col_reporter", name: "Reporter", type: "user", width: 180 },
    { id: "col_assignee", name: "Assignee", type: "user", width: 180 },
    { id: "col_found", name: "Found on", type: "date", width: 150 },
    { id: "col_description", name: "Steps to reproduce", type: "longText", width: 280 },
    { id: "col_evidence", name: "Evidence", type: "attachment", width: 180 },
    { id: "col_task", name: "Related task", type: "relation" },
  ]),
  views: [
    { name: "All bugs", type: "table" },
    { name: "Triage", type: "kanban", groupByColumnId: "col_status" },
    { name: "By severity", type: "table", sorts: [{ columnId: "col_severity", direction: "asc" }] },
  ],
};

const QA: BoardTemplate = {
  id: "qa",
  name: "QA / QC board",
  description: "Test cases with result, suite, environment and evidence.",
  rowIdPrefix: "QA",
  primaryColumnId: "col_title",
  columns: schema([
    { id: "col_title", name: "Test case", type: "text", isPrimary: true },
    {
      id: "col_result",
      name: "Result",
      type: "select",
      width: 140,
      options: options(
        [
          ["Not run", "gray"],
          ["Passed", "green"],
          ["Failed", "red"],
          ["Blocked", "amber"],
        ],
        "result",
      ),
      completedOptionIds: ["result_1"],
    },
    {
      id: "col_suite",
      name: "Suite",
      type: "select",
      width: 150,
      options: options(
        [
          ["Smoke", "cyan"],
          ["Regression", "blue"],
          ["Integration", "violet"],
          ["UAT", "pink"],
        ],
        "suite",
      ),
    },
    { id: "col_env", name: "Environment", type: "select", width: 150, options: ENVIRONMENT_OPTIONS },
    { id: "col_tester", name: "Tester", type: "user", width: 180 },
    { id: "col_executed", name: "Executed on", type: "date", width: 150 },
    { id: "col_description", name: "Expected result", type: "longText", width: 280 },
    { id: "col_evidence", name: "Evidence", type: "attachment", width: 180 },
    { id: "col_bug", name: "Related bug", type: "relation" },
  ]),
  views: [
    { name: "All cases", type: "table" },
    { name: "By result", type: "kanban", groupByColumnId: "col_result" },
    { name: "Execution", type: "calendar", dateColumnId: "col_executed" },
  ],
};

/**
 * DV-API-20. `API ID` is the board's own row identifier (`API-001`), so it is a
 * prefix rather than a column — one source of truth for the reference code.
 */
const API_DOCS: BoardTemplate = {
  id: "apiDocs",
  name: "API documentation",
  description: "Endpoint catalogue with method tags, auth and owner.",
  rowIdPrefix: "API",
  primaryColumnId: "col_endpoint",
  columns: schema([
    { id: "col_endpoint", name: "Endpoint", type: "text", isPrimary: true, width: 300 },
    {
      id: "col_method",
      name: "Method",
      type: "select",
      width: 120,
      options: METHOD_OPTIONS,
    },
    {
      id: "col_domain",
      name: "Domain",
      type: "select",
      width: 200,
      options: options(
        [
          ["api.nexdrop.vn", "blue"],
          ["staging-api.nexdrop.vn", "amber"],
          ["localhost:6868", "gray"],
        ],
        "domain",
      ),
    },
    {
      id: "col_auth",
      name: "Auth",
      type: "select",
      width: 150,
      options: options(
        [
          ["Public", "gray"],
          ["Bearer token", "blue"],
          ["API key", "violet"],
          ["Admin only", "red"],
        ],
        "auth",
      ),
    },
    { id: "col_env", name: "Environment", type: "select", width: 150, options: ENVIRONMENT_OPTIONS },
    { id: "col_description", name: "Description", type: "longText", width: 300 },
    { id: "col_owner", name: "Owner", type: "user", width: 180 },
    { id: "col_task", name: "Related task", type: "relation" },
  ]),
  views: [
    { name: "Catalogue", type: "table" },
    { name: "By method", type: "kanban", groupByColumnId: "col_method" },
  ],
};

const CATALOG: Readonly<Record<BoardTemplateId, BoardTemplate>> = {
  task: TASK,
  bug: BUG,
  qa: QA,
  apiDocs: API_DOCS,
};

export const BOARD_TEMPLATES: readonly BoardTemplate[] = [TASK, BUG, QA, API_DOCS];

export function templateById(id: string | undefined): BoardTemplate | null {
  return id && id in CATALOG ? CATALOG[id as BoardTemplateId] : null;
}

/** Columns of a template, deep-copied so the board owns every object it holds. */
export function instantiateColumns(template: BoardTemplate): readonly BoardColumn[] {
  return template.columns.map((source) => {
    const copy = { ...source } as BoardColumn;

    if (copy.type === "select") {
      const { transitionRules, completedOptionIds } = copy.config;

      // Every nested structure is copied too: a board must be able to rewrite
      // its own rules without the template it came from ever changing.
      return {
        ...copy,
        config: {
          ...copy.config,
          options: copy.config.options.map((option) => ({
            ...option,
            ...(option.availability
              ? { availability: cloneConditionGroup(option.availability) }
              : {}),
          })),
          ...(completedOptionIds ? { completedOptionIds: [...completedOptionIds] } : {}),
          ...(transitionRules
            ? {
                transitionRules: {
                  ...transitionRules,
                  transitions: Object.fromEntries(
                    Object.entries(transitionRules.transitions).map(([from, to]) => [from, [...to]]),
                  ),
                },
              }
            : {}),
        },
      };
    }

    return { ...copy, config: { ...copy.config } } as BoardColumn;
  });
}

/** Freeze the catalog so an accidental in-place write fails loudly in dev. */
for (const template of BOARD_TEMPLATES) {
  Object.freeze(template);
  Object.freeze(template.columns);
  Object.freeze(template.views);
  for (const item of template.columns) {
    Object.freeze(item);
    Object.freeze(item.config);
    if (item.type === "select") {
      Object.freeze(item.config.options);
      for (const option of item.config.options) Object.freeze(option);
    }
  }
}

function cloneConditionGroup(group: ConditionGroup): ConditionGroup {
  return {
    ...group,
    conditions: group.conditions.map((condition) => ({
      ...condition,
      ...(condition.values ? { values: [...condition.values] } : {}),
    })),
    groups: group.groups.map(cloneConditionGroup),
  };
}
