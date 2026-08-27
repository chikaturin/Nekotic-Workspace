import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  conditionOperatorsFor,
  describeCondition,
  describeConditionGroup,
  evaluateConditionGroup,
  isConditionGroupEmpty,
  makeConditionGroup,
  reconcileConditionOperator,
  valueArityFor,
  makeCondition,
  withCondition,
  withConditionPatched,
  withGroup,
  withGroupPatched,
  withoutCondition,
  withoutGroup,
  type ConditionScope,
} from "@/lib/conditions";
import { guardCellEdits } from "@/lib/board-write-rules";
import {
  allowAllTransitions,
  allowedTargets,
  clearAllTransitions,
  clearTransitionsFor,
  isGoverned,
  linearTransitions,
  setTransitions,
  strandedKeys,
  ungovernedKeys,
  EMPTY_OPTION_KEY,
  evaluateTransition,
  pruneTransitionRules,
  seedTransitionRules,
  toggleTransition,
  transitionKeyOf,
  transitionKeys,
} from "@/lib/transition-rules";
import { resolveOptionAvailability, visibleOptions } from "@/lib/select-availability";
import { UNGROUPED_KEY } from "@/lib/board-grouping";
import { boardService } from "@/services/board-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type {
  Board,
  BoardColumn,
  BoardColumnOf,
  BoardRow,
  CellValue,
  TransitionRules,
} from "@/types";
import { buildTestTree, ID, TEST_WORKSPACE } from "./helpers";

/**
 * Rules are configuration.
 *
 * Every case here writes the rule as data and then asserts the behaviour. If a
 * pair of statuses were ever hard-coded, these tests would still pass with the
 * rule table emptied — so each one also checks the *unconfigured* board still
 * behaves exactly as it did before rules existed.
 */

const WORKSPACE_ID = "ws_test";

/* ------------------------------------------------------------- fixtures */

const DEBUG = "o_debug";
const FIXING = "o_fixing";
const REVIEW = "o_review";
const DONE = "o_done";

function statusColumn(rules?: TransitionRules): BoardColumnOf<"select"> {
  return {
    id: "col_status",
    name: "Status",
    position: 1,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "select",
    config: {
      isMulti: false,
      options: [
        { id: DEBUG, label: "Debug", color: "gray" },
        { id: FIXING, label: "Fixing", color: "blue" },
        { id: REVIEW, label: "Review", color: "violet" },
        { id: DONE, label: "Done", color: "green" },
      ],
      ...(rules ? { transitionRules: rules } : {}),
    },
  };
}

/** The example from the brief, written the way a user would write it. */
const USER_RULES: TransitionRules = {
  enabled: true,
  mode: "allow-list",
  transitions: {
    [DEBUG]: [FIXING],
    [FIXING]: [DEBUG, REVIEW],
    [REVIEW]: [FIXING, DONE],
    [DONE]: [],
    [EMPTY_OPTION_KEY]: [DEBUG],
  },
};

function record(cells: Readonly<Record<string, CellValue>> = {}): BoardRow {
  return {
    id: "r1",
    boardId: "brd",
    displayId: "TASK-001",
    sequence: 1,
    cells,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    createdBy: "u1",
    revision: 1,
  };
}

/* ---------------------------------------------------------- transitions */

describe("transition rules", () => {
  test("with rules off, every change is permitted", () => {
    const column = statusColumn();

    expect(evaluateTransition(column, DEBUG, DONE).isAllowed).toBe(true);
    expect(allowedTargets(column, DEBUG)).toEqual(transitionKeys(column.config.options));
  });

  test("declared transitions pass and undeclared ones are refused", () => {
    const column = statusColumn(USER_RULES);

    expect(evaluateTransition(column, DEBUG, FIXING).isAllowed).toBe(true);
    expect(evaluateTransition(column, FIXING, REVIEW).isAllowed).toBe(true);
    expect(evaluateTransition(column, REVIEW, DONE).isAllowed).toBe(true);
    expect(evaluateTransition(column, DONE, FIXING).isAllowed).toBe(false);
  });

  test("Debug straight to Done is refused, and the refusal names both ends", () => {
    const verdict = evaluateTransition(statusColumn(USER_RULES), DEBUG, DONE);

    expect(verdict.isAllowed).toBe(false);
    expect(verdict.reason).toContain("Debug");
    expect(verdict.reason).toContain("Done");
  });

  test("the same table with rules disabled allows what it refused", () => {
    const column = statusColumn({ ...USER_RULES, enabled: false });

    expect(evaluateTransition(column, DEBUG, DONE).isAllowed).toBe(true);
  });

  test("staying put is always allowed", () => {
    expect(evaluateTransition(statusColumn(USER_RULES), DONE, DONE).isAllowed).toBe(true);
  });

  test("Kanban's ungrouped column maps onto the empty key", () => {
    expect(transitionKeyOf(UNGROUPED_KEY)).toBe(EMPTY_OPTION_KEY);
    expect(evaluateTransition(statusColumn(USER_RULES), UNGROUPED_KEY, DEBUG).isAllowed).toBe(true);
    expect(evaluateTransition(statusColumn(USER_RULES), UNGROUPED_KEY, DONE).isAllowed).toBe(false);
  });

  test("the refusal says where the record can go instead", () => {
    const verdict = evaluateTransition(statusColumn(USER_RULES), DEBUG, DONE);

    expect(verdict.reason).toContain("Debug can move to Fixing");
  });

  test("turning rules on starts from the column's own order, both ways", () => {
    const options = statusColumn().config.options;
    const seeded = seedTransitionRules(options);
    const column = statusColumn(seeded);

    expect(seeded.enabled).toBe(true);
    // Debug → Fixing → Review → Done, and back again — but never a skip.
    expect(evaluateTransition(column, DEBUG, FIXING).isAllowed).toBe(true);
    expect(evaluateTransition(column, FIXING, DEBUG).isAllowed).toBe(true);
    expect(evaluateTransition(column, REVIEW, DONE).isAllowed).toBe(true);
    expect(evaluateTransition(column, DEBUG, DONE).isAllowed).toBe(false);
  });

  test("a linear preset without backward moves is one-way", () => {
    const column = statusColumn(linearTransitions(statusColumn().config.options));

    expect(evaluateTransition(column, FIXING, REVIEW).isAllowed).toBe(true);
    expect(evaluateTransition(column, REVIEW, FIXING).isAllowed).toBe(false);
  });

  test("allow-all governs every status and refuses nothing", () => {
    const options = statusColumn().config.options;
    const rules = allowAllTransitions(options);
    const column = statusColumn(rules);

    expect(ungovernedKeys(rules, options)).toEqual([]);
    expect(evaluateTransition(column, DEBUG, DONE).isAllowed).toBe(true);
  });

  test("clear-all governs every status and refuses everything", () => {
    const options = statusColumn().config.options;
    const rules = clearAllTransitions(options);

    expect(strandedKeys(rules, options)).toEqual(transitionKeys(options));
    expect(evaluateTransition(statusColumn(rules), DEBUG, FIXING).isAllowed).toBe(false);
  });

  /**
   * Adding a status must never freeze it, or the board around it. A rule table
   * that says nothing about a status is not a rule refusing every move — it is
   * the absence of a decision.
   */
  test("a status the table does not mention is unrestricted", () => {
    const TESTING = "o_testing";
    const options = [
      ...statusColumn().config.options,
      { id: TESTING, label: "Testing", color: "amber" } as const,
    ];

    const column: BoardColumnOf<"select"> = {
      ...statusColumn(USER_RULES),
      config: { ...statusColumn(USER_RULES).config, options },
    };

    expect(ungovernedKeys(USER_RULES, options)).toEqual([TESTING]);
    // Out of the new status, and into it from a governed one.
    expect(evaluateTransition(column, TESTING, DONE).isAllowed).toBe(true);
    expect(evaluateTransition(column, DEBUG, TESTING).isAllowed).toBe(true);
    // ...while the rules that *were* written still hold.
    expect(evaluateTransition(column, DEBUG, DONE).isAllowed).toBe(false);
    expect(allowedTargets(column, DEBUG)).toContain(TESTING);
  });

  test("a governed status with no targets is stranded, and resettable", () => {
    const frozen = setTransitions(USER_RULES, DEBUG, []);
    expect(evaluateTransition(statusColumn(frozen), DEBUG, FIXING).isAllowed).toBe(false);

    const lifted = clearTransitionsFor(frozen, DEBUG);
    expect(isGoverned(lifted, DEBUG)).toBe(false);
    expect(evaluateTransition(statusColumn(lifted), DEBUG, FIXING).isAllowed).toBe(true);
  });

  /** Rules are keyed by option id, so a label is free to change. */
  test("renaming a status leaves its transitions intact", () => {
    const base = statusColumn(USER_RULES);
    const renamed: BoardColumnOf<"select"> = {
      ...base,
      config: {
        ...base.config,
        options: base.config.options.map((option) =>
          option.id === DEBUG ? { ...option, label: "Investigating" } : option,
        ),
      },
    };

    expect(evaluateTransition(renamed, DEBUG, FIXING).isAllowed).toBe(true);
    expect(evaluateTransition(renamed, DEBUG, DONE).isAllowed).toBe(false);
    expect(evaluateTransition(renamed, DEBUG, DONE).reason).toContain("Investigating");
  });

  test("toggling an edge adds it, then removes it", () => {
    const once = toggleTransition(USER_RULES, DEBUG, DONE);
    expect(evaluateTransition(statusColumn(once), DEBUG, DONE).isAllowed).toBe(true);

    const twice = toggleTransition(once, DEBUG, DONE);
    expect(evaluateTransition(statusColumn(twice), DEBUG, DONE).isAllowed).toBe(false);
  });

  test("pruning drops edges pointing at deleted options", () => {
    const remaining = statusColumn().config.options.filter((option) => option.id !== DONE);
    const pruned = pruneTransitionRules(USER_RULES, remaining);

    expect(pruned.transitions[REVIEW]).toEqual([FIXING]);
    expect(pruned.transitions[DONE]).toBeUndefined();
  });
});

/* ----------------------------------------------------------- conditions */

describe("condition evaluator", () => {
  const qa: BoardColumnOf<"select"> = {
    id: "col_qa",
    name: "QA Status",
    position: 2,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "select",
    config: {
      isMulti: false,
      options: [
        { id: "qa_passed", label: "Passed", color: "green" },
        { id: "qa_failed", label: "Failed", color: "red" },
      ],
    },
  };

  const reviewer: BoardColumn = {
    id: "col_reviewer",
    name: "Reviewer",
    position: 3,
    width: 180,
    hidden: false,
    isPrimary: false,
    type: "user",
    config: { isMulti: false },
  };

  const columns: readonly BoardColumn[] = [statusColumn(), qa, reviewer];

  function scope(cells: Readonly<Record<string, CellValue>>): ConditionScope {
    return {
      row: record(cells),
      columns: new Map(columns.map((column) => [column.id, column])),
      context: {},
    };
  }

  const passedAndReviewed = {
    id: "g1",
    conjunction: "and" as const,
    conditions: [
      { id: "c1", columnId: "col_qa", operator: "is" as const, value: "qa_passed" },
      { id: "c2", columnId: "col_reviewer", operator: "isNotEmpty" as const, value: "" },
    ],
    groups: [],
  };

  test("an empty group is satisfied — no conditions means no gate", () => {
    expect(isConditionGroupEmpty(makeConditionGroup("g"))).toBe(true);
    expect(evaluateConditionGroup(makeConditionGroup("g"), scope({}))).toBe(true);
    expect(evaluateConditionGroup(null, scope({}))).toBe(true);
  });

  test("AND requires every condition", () => {
    expect(
      evaluateConditionGroup(
        passedAndReviewed,
        scope({
          col_qa: { kind: "select", optionIds: ["qa_passed"] },
          col_reviewer: { kind: "user", userIds: ["u1"] },
        }),
      ),
    ).toBe(true);

    expect(
      evaluateConditionGroup(
        passedAndReviewed,
        scope({
          col_qa: { kind: "select", optionIds: ["qa_passed"] },
          col_reviewer: { kind: "user", userIds: [] },
        }),
      ),
    ).toBe(false);
  });

  test("OR needs only one", () => {
    const either = { ...passedAndReviewed, conjunction: "or" as const };

    expect(
      evaluateConditionGroup(
        either,
        scope({ col_qa: { kind: "select", optionIds: ["qa_passed"] } }),
      ),
    ).toBe(true);
  });

  test("a nested group expresses A and (B or C)", () => {
    const nested = withGroup(
      {
        id: "root",
        conjunction: "and",
        conditions: [
          { id: "c1", columnId: "col_qa", operator: "is", value: "qa_passed" },
        ],
        groups: [],
      },
      {
        id: "inner",
        conjunction: "or",
        conditions: [
          { id: "c2", columnId: "col_reviewer", operator: "isNotEmpty", value: "" },
          { id: "c3", columnId: "col_status", operator: "is", value: REVIEW },
        ],
        groups: [],
      },
    );

    expect(
      evaluateConditionGroup(
        nested,
        scope({
          col_qa: { kind: "select", optionIds: ["qa_passed"] },
          col_status: { kind: "select", optionIds: [REVIEW] },
        }),
      ),
    ).toBe(true);

    expect(
      evaluateConditionGroup(
        nested,
        scope({
          col_qa: { kind: "select", optionIds: ["qa_passed"] },
          col_status: { kind: "select", optionIds: [DEBUG] },
        }),
      ),
    ).toBe(false);
  });

  test("isAnyOf and isNoneOf read the value list", () => {
    const anyOf = {
      id: "g",
      conjunction: "and" as const,
      conditions: [
        {
          id: "c",
          columnId: "col_qa",
          operator: "isAnyOf" as const,
          value: "",
          values: ["qa_passed", "qa_failed"],
        },
      ],
      groups: [],
    };

    expect(
      evaluateConditionGroup(anyOf, scope({ col_qa: { kind: "select", optionIds: ["qa_failed"] } })),
    ).toBe(true);

    const noneOf = {
      ...anyOf,
      conditions: [{ ...anyOf.conditions[0]!, operator: "isNoneOf" as const }],
    };

    expect(
      evaluateConditionGroup(noneOf, scope({ col_qa: { kind: "select", optionIds: ["qa_failed"] } })),
    ).toBe(false);
  });

  test("a condition on a deleted column is ignored rather than failing closed", () => {
    const stale = {
      id: "g",
      conjunction: "and" as const,
      conditions: [{ id: "c", columnId: "col_gone", operator: "is" as const, value: "x" }],
      groups: [],
    };

    expect(evaluateConditionGroup(stale, scope({}))).toBe(true);
  });

  test("operators are offered per column type, and reconciled on a switch", () => {
    expect(conditionOperatorsFor("date")).toContain("before");
    expect(conditionOperatorsFor("date")).not.toContain("contains");
    expect(conditionOperatorsFor("select")).toContain("isAnyOf");

    expect(reconcileConditionOperator("date", "contains")).toBe("before");
    expect(reconcileConditionOperator("text", "contains")).toBe("contains");

    expect(valueArityFor("isEmpty")).toBe("none");
    expect(valueArityFor("isAnyOf")).toBe("list");
    expect(valueArityFor("is")).toBe("single");
  });

  test("a group reads back as a sentence", () => {
    expect(describeConditionGroup(passedAndReviewed, columns)).toBe(
      "QA Status is Passed and Reviewer is not empty",
    );
  });

  test("group edits are immutable", () => {
    const base = makeConditionGroup("g");
    const added = withCondition(base, {
      id: "c",
      columnId: "col_qa",
      operator: "is",
      value: "qa_passed",
    });

    expect(base.conditions).toHaveLength(0);
    expect(added.conditions).toHaveLength(1);

    const patched = withConditionPatched(added, "c", { value: "qa_failed" });
    expect(added.conditions[0]?.value).toBe("qa_passed");
    expect(patched.conditions[0]?.value).toBe("qa_failed");

    expect(withoutCondition(patched, "c").conditions).toHaveLength(0);
  });
});

describe("conditions on the other column types", () => {
  const title: BoardColumn = {
    id: "col_title",
    name: "Title",
    position: 0,
    width: 280,
    hidden: false,
    isPrimary: true,
    type: "text",
    config: {},
  };

  const due: BoardColumn = {
    id: "col_due",
    name: "Due date",
    position: 4,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "date",
    config: { includesTime: false },
  };

  const blocks: BoardColumn = {
    id: "col_blocks",
    name: "Blocked by",
    position: 5,
    width: 180,
    hidden: false,
    isPrimary: false,
    type: "relation",
    config: { boardId: null, displayColumnId: null, isMulti: true },
  };

  const columns: readonly BoardColumn[] = [title, due, blocks, statusColumn()];

  function scope(cells: Readonly<Record<string, CellValue>>): ConditionScope {
    return {
      row: record(cells),
      columns: new Map(columns.map((column) => [column.id, column])),
      context: {},
    };
  }

  function group(condition: {
    columnId: string;
    operator: Parameters<typeof describeCondition>[0]["operator"];
    value: string;
    values?: readonly string[];
  }) {
    return {
      id: "g",
      conjunction: "and" as const,
      conditions: [{ id: "c", ...condition }],
      groups: [],
    };
  }

  test("text columns compare, contain and exclude", () => {
    const cells = { col_title: { kind: "text" as const, value: "Implement Payment" } };

    expect(
      evaluateConditionGroup(
        group({ columnId: "col_title", operator: "contains", value: "payment" }),
        scope(cells),
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_title", operator: "notContains", value: "refund" }),
        scope(cells),
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_title", operator: "is", value: "implement payment" }),
        scope(cells),
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_title", operator: "isNot", value: "implement payment" }),
        scope(cells),
      ),
    ).toBe(false);
    expect(
      evaluateConditionGroup(
        group({
          columnId: "col_title",
          operator: "isAnyOf",
          value: "",
          values: ["implement payment", "other"],
        }),
        scope(cells),
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_title", operator: "isNoneOf", value: "", values: ["other"] }),
        scope(cells),
      ),
    ).toBe(true);
  });

  test("dates compare whole calendar days", () => {
    const cells = { col_due: { kind: "date" as const, iso: "2026-08-20T09:30:00.000Z" } };

    expect(
      evaluateConditionGroup(
        group({ columnId: "col_due", operator: "before", value: "2026-08-25" }),
        scope(cells),
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_due", operator: "after", value: "2026-08-25" }),
        scope(cells),
      ),
    ).toBe(false);
    // Same day, different time of day — still "on".
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_due", operator: "on", value: "2026-08-20" }),
        scope(cells),
      ),
    ).toBe(true);
  });

  test("an empty date never satisfies a comparison, and junk never gates", () => {
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_due", operator: "before", value: "2026-08-25" }),
        scope({ col_due: { kind: "date", iso: null } }),
      ),
    ).toBe(false);

    // A bound that will not parse must not silently lock the option.
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_due", operator: "before", value: "not a date" }),
        scope({ col_due: { kind: "date", iso: "2026-08-20T00:00:00.000Z" } }),
      ),
    ).toBe(true);
  });

  test("relation columns answer emptiness and substring", () => {
    expect(
      evaluateConditionGroup(
        group({ columnId: "col_blocks", operator: "isEmpty", value: "" }),
        scope({ col_blocks: { kind: "relation", rowIds: [] } }),
      ),
    ).toBe(true);

    expect(
      evaluateConditionGroup(
        group({ columnId: "col_blocks", operator: "contains", value: "r9" }),
        scope({ col_blocks: { kind: "relation", rowIds: ["r9"] } }),
      ),
    ).toBe(true);
  });

  test("a condition added from the builder is valid immediately", () => {
    expect(makeCondition(due, "c1")).toMatchObject({ columnId: "col_due", operator: "before" });
    expect(makeCondition(title, "c2")).toMatchObject({ columnId: "col_title", operator: "is" });
  });

  test("a condition reads back as a sentence, with labels not ids", () => {
    expect(
      describeCondition(
        { id: "c", columnId: "col_status", operator: "is", value: DONE },
        columns,
      ),
    ).toBe("Status is Done");

    expect(
      describeCondition({ id: "c", columnId: "col_blocks", operator: "isEmpty", value: "" }, columns),
    ).toBe("Blocked by is empty");

    expect(
      describeCondition({ id: "c", columnId: "col_gone", operator: "is", value: "x" }, columns),
    ).toBe("Field is x");
  });

  test("nested groups are added, patched and removed immutably", () => {
    const root = withGroup(makeConditionGroup("root"), makeConditionGroup("inner"));
    expect(root.groups).toHaveLength(1);

    const withInnerCondition = withGroupPatched(root, "inner", {
      conditions: [{ id: "c", columnId: "col_title", operator: "contains", value: "pay" }],
    });
    expect(root.groups[0]?.conditions).toHaveLength(0);
    expect(withInnerCondition.groups[0]?.conditions).toHaveLength(1);

    // A patch reaches a condition inside a nested group, not just the root.
    const patched = withConditionPatched(withInnerCondition, "c", { value: "refund" });
    expect(patched.groups[0]?.conditions[0]?.value).toBe("refund");

    const cleared = withoutCondition(patched, "c");
    expect(cleared.groups[0]?.conditions).toHaveLength(0);

    expect(withoutGroup(withInnerCondition, "inner").groups).toHaveLength(0);
  });

  test("a group holding only empty groups is still empty, and never gates", () => {
    const hollow = withGroup(makeConditionGroup("root"), makeConditionGroup("inner"));

    expect(isConditionGroupEmpty(hollow)).toBe(true);
    expect(evaluateConditionGroup(hollow, scope({}))).toBe(true);
    expect(describeConditionGroup(hollow, columns)).toBe("");
  });

  test("an OR group reads back with or between its parts", () => {
    const either = {
      id: "g",
      conjunction: "or" as const,
      conditions: [
        { id: "c1", columnId: "col_title", operator: "contains" as const, value: "pay" },
        { id: "c2", columnId: "col_blocks", operator: "isNotEmpty" as const, value: "" },
      ],
      groups: [],
    };

    expect(describeConditionGroup(either, columns)).toBe(
      "Title contains pay or Blocked by is not empty",
    );
  });
});

/* -------------------------------------------------- option availability */

describe("conditional select options", () => {
  const qa: BoardColumnOf<"select"> = {
    id: "col_qa",
    name: "QA Status",
    position: 2,
    width: 150,
    hidden: false,
    isPrimary: false,
    type: "select",
    config: {
      isMulti: false,
      options: [
        { id: "qa_passed", label: "Passed", color: "green" },
        { id: "qa_failed", label: "Failed", color: "red" },
      ],
    },
  };

  /** "Done is available only when QA Status = Passed", written as data. */
  function gated(): BoardColumnOf<"select"> {
    const base = statusColumn();

    return {
      ...base,
      config: {
        ...base.config,
        options: base.config.options.map((option) =>
          option.id === DONE
            ? {
                ...option,
                availability: {
                  id: "rule",
                  conjunction: "and" as const,
                  conditions: [
                    { id: "c", columnId: "col_qa", operator: "is" as const, value: "qa_passed" },
                  ],
                  groups: [],
                },
              }
            : option,
        ),
      },
    };
  }

  function resolve(column: BoardColumnOf<"select">, cells: Readonly<Record<string, CellValue>>) {
    return resolveOptionAvailability({
      column,
      row: record(cells),
      columns: [column, qa],
      context: {},
    });
  }

  test("QA failed disables Done and says why", () => {
    const entries = resolve(gated(), { col_qa: { kind: "select", optionIds: ["qa_failed"] } });
    const done = entries.find((entry) => entry.option.id === DONE);

    expect(done?.isAvailable).toBe(false);
    expect(done?.reason).toBe("condition");
    expect(done?.explanation).toContain("QA Status is Passed");
  });

  test("QA passed makes Done available immediately", () => {
    const entries = resolve(gated(), { col_qa: { kind: "select", optionIds: ["qa_passed"] } });

    expect(entries.find((entry) => entry.option.id === DONE)?.isAvailable).toBe(true);
  });

  test("an option switched off is never available, whatever the record holds", () => {
    const base = statusColumn();
    const column: BoardColumnOf<"select"> = {
      ...base,
      config: {
        ...base.config,
        options: base.config.options.map((option) =>
          option.id === REVIEW ? { ...option, isDisabled: true } : option,
        ),
      },
    };

    const entry = resolve(column, {}).find((candidate) => candidate.option.id === REVIEW);
    expect(entry?.isAvailable).toBe(false);
    expect(entry?.reason).toBe("disabled");
  });

  test("a transition rule disables the options it cannot reach", () => {
    const entries = resolve(statusColumn(USER_RULES), {
      col_status: { kind: "select", optionIds: [DEBUG] },
    });

    expect(entries.find((entry) => entry.option.id === FIXING)?.isAvailable).toBe(true);

    const done = entries.find((entry) => entry.option.id === DONE);
    expect(done?.isAvailable).toBe(false);
    expect(done?.reason).toBe("transition");
  });

  test("hidden drops unavailable options, disabled keeps them", () => {
    const entries = resolve(gated(), { col_qa: { kind: "select", optionIds: ["qa_failed"] } });

    expect(visibleOptions(entries, "hidden")).toHaveLength(3);
    expect(visibleOptions(entries, "disabled")).toHaveLength(4);
  });

  test("a column with no rules offers every option", () => {
    const entries = resolve(statusColumn(), {});

    expect(entries.every((entry) => entry.isAvailable)).toBe(true);
  });
});

/* ------------------------------------------------------------ the guard */

describe("the write guard", () => {
  const board = {
    id: "brd",
    nodeId: "n",
    workspaceId: "ws",
    name: "Board",
    rowIdPrefix: "TASK",
    primaryColumnId: "col_title",
    columns: [statusColumn(USER_RULES)],
    views: [],
    createdAt: "",
    updatedAt: "",
  } as unknown as Board;

  const rowsById = {
    r1: record({ col_status: { kind: "select", optionIds: [DEBUG] } }),
  };

  test("a refused transition is separated out, with a reason", () => {
    const result = guardCellEdits({
      edits: [
        { rowId: "r1", columnId: "col_status", value: { kind: "select", optionIds: [DONE] } },
      ],
      board,
      rowsById,
      context: {},
    });

    expect(result.allowed).toHaveLength(0);
    expect(result.rejected[0]?.message).toContain("Done");
  });

  test("a permitted transition passes straight through", () => {
    const result = guardCellEdits({
      edits: [
        { rowId: "r1", columnId: "col_status", value: { kind: "select", optionIds: [FIXING] } },
      ],
      board,
      rowsById,
      context: {},
    });

    expect(result.allowed).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  test("clearing a status is never gated", () => {
    const result = guardCellEdits({
      edits: [{ rowId: "r1", columnId: "col_status", value: { kind: "select", optionIds: [] } }],
      board,
      rowsById,
      context: {},
    });

    expect(result.allowed).toHaveLength(1);
  });

  test("non-select edits are untouched", () => {
    const result = guardCellEdits({
      edits: [{ rowId: "r1", columnId: "col_title", value: { kind: "text", value: "hello" } }],
      board,
      rowsById,
      context: {},
    });

    expect(result.allowed).toHaveLength(1);
  });
});

/* ---------------------------------------------------------- integration */

describe("rules through the board store", () => {
  beforeEach(async () => {
    resetSimulation();
    setSimulation({ latency: "fast" });
    boardService.reset();

    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
      treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
      feedback: null,
      seed: 0,
    });

    await useBoardStore.getState().load(ID.roadmap);
  });

  async function enableRules(table: Readonly<Record<string, readonly string[]>>) {
    await useBoardStore.getState().updateColumnConfig("col_status", {
      config: { transitionRules: { enabled: true, mode: "allow-list", transitions: table } },
    });
  }

  function firstRow(): BoardRow {
    const state = useBoardStore.getState();
    const id = state.rowOrder[0];
    const row = id ? state.rowsById[id] : undefined;
    if (!row) throw new Error("board did not load");
    return row;
  }

  test("a refused status change leaves the record untouched", async () => {
    const row = firstRow();

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_0"] } },
    ]);
    await enableRules({ status_0: ["status_1"], status_1: ["status_4"], status_4: [] });

    const before = useBoardStore.getState().rowsById[row.id];

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_4"] } },
    ]);

    const after = useBoardStore.getState().rowsById[row.id];
    expect(after?.cells.col_status).toEqual(before?.cells.col_status);
    expect(after?.revision).toBe(before?.revision);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  test("the declared step is written normally", async () => {
    const row = firstRow();

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_0"] } },
    ]);
    await enableRules({ status_0: ["status_1"], status_1: ["status_4"], status_4: [] });

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_1"] } },
    ]);

    expect(useBoardStore.getState().rowsById[row.id]?.cells.col_status).toEqual({
      kind: "select",
      optionIds: ["status_1"],
    });
  });

  /**
   * A permitted move is still optimistic, and the service is still allowed to
   * say no — the record has to come back, without the board being reloaded.
   */
  test("a permitted move that the service rejects rolls the record back", async () => {
    const row = firstRow();

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_0"] } },
    ]);
    await enableRules({ status_0: ["status_1"], status_1: ["status_4"], status_4: [] });

    const before = useBoardStore.getState().rowsById[row.id];
    const rowCount = useBoardStore.getState().rowOrder.length;

    const failing = vi
      .spyOn(boardService, "updateCells")
      .mockRejectedValue(new Error("the server said no"));
    const reload = vi.spyOn(boardService, "getBoard");

    try {
      await useBoardStore.getState().editCells([
        {
          rowId: row.id,
          columnId: "col_status",
          value: { kind: "select", optionIds: ["status_1"] },
        },
      ]);
    } finally {
      failing.mockRestore();
    }

    const after = useBoardStore.getState().rowsById[row.id];
    expect(after?.cells.col_status).toEqual(before?.cells.col_status);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
    // No reload: the same records are still in place, fetched no further.
    expect(reload).not.toHaveBeenCalled();
    expect(useBoardStore.getState().rowOrder).toHaveLength(rowCount);
    reload.mockRestore();
  });

  test("switching the rules off permits what they refused", async () => {
    const row = firstRow();

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_0"] } },
    ]);
    await enableRules({ status_0: ["status_1"], status_1: ["status_4"], status_4: [] });

    await useBoardStore.getState().updateColumnConfig("col_status", {
      config: { transitionRules: { enabled: false, mode: "allow-list", transitions: {} } },
    });

    await useBoardStore.getState().editCells([
      { rowId: row.id, columnId: "col_status", value: { kind: "select", optionIds: ["status_4"] } },
    ]);

    expect(useBoardStore.getState().rowsById[row.id]?.cells.col_status).toEqual({
      kind: "select",
      optionIds: ["status_4"],
    });
  });
});

describe("bulk writes obey the same rules", () => {
  beforeEach(async () => {
    resetSimulation();
    setSimulation({ latency: "fast" });
    boardService.reset();

    useWorkspaceStore.setState({
      workspaces: [TEST_WORKSPACE],
      activeWorkspaceId: WORKSPACE_ID,
      treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
      feedback: null,
      seed: 0,
    });

    await useBoardStore.getState().load(ID.roadmap);
  });

  test("a bulk status change skips the records the rules refuse", async () => {
    const rowIds = useBoardStore.getState().rowOrder.slice(0, 3);

    await useBoardStore.getState().bulkUpdate(rowIds, {
      col_status: { kind: "select", optionIds: ["status_0"] },
    });

    await useBoardStore.getState().updateColumnConfig("col_status", {
      config: {
        transitionRules: {
          enabled: true,
          mode: "allow-list",
          transitions: { status_0: ["status_1"], status_1: ["status_4"], status_4: [] },
        },
      },
    });

    await useBoardStore.getState().bulkUpdate(rowIds, {
      col_status: { kind: "select", optionIds: ["status_4"] },
    });

    const state = useBoardStore.getState();
    for (const rowId of rowIds) {
      expect(state.rowsById[rowId]?.cells.col_status).toEqual({
        kind: "select",
        optionIds: ["status_0"],
      });
    }
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });
});
