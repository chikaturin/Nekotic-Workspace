import { beforeEach, describe, expect, test } from "vitest";
import { apiColumns, findDuplicateEndpoints } from "@/lib/api-catalog";
import { indexRows } from "@/lib/board-records";
import {
  BOARD_TEMPLATES,
  ENVIRONMENT_OPTIONS,
  instantiateColumns,
  METHOD_OPTIONS,
  PRODUCTION_OPTION_ID,
  templateById,
} from "@/lib/board-templates";
import { cellText, DELETED_LABEL } from "@/lib/cell-values";
import { formatJson, lintJson } from "@/lib/json-lint";
import { formatFromName, tokenize, tokenizeLine } from "@/lib/syntax";
import { boardService } from "@/services/board-service";
import { devtoolsService } from "@/services/devtools-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { doc, board, file, folder, hydrate, project, type NodeSpec } from "@/mock/factory";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardColumnOf, DriveNode } from "@/types";

const WORKSPACE_ID = "ws_dev";

/** A tree with the three developer-tool surfaces on it. */
function buildDevTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Platform",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        board({ name: "API Catalogue", boardKind: "table", templateId: "apiDocs", itemCount: 18, openCount: 2 }),
        board({ name: "Task Board", boardKind: "table", templateId: "task", itemCount: 4, openCount: 1 }),
        doc({
          name: "Service config",
          documentKind: "config",
          icon: "⚙️",
          blockCount: 0,
          excerpt: "",
          updatedHoursAgo: 2,
        }),
        doc({
          name: "Service secrets",
          documentKind: "secret",
          icon: "🔐",
          blockCount: 0,
          excerpt: "",
          updatedHoursAgo: 3,
        }),
        folder({ name: "Docs", updatedHoursAgo: 4, children: [file({ name: "a.md", sizeBytes: 10, updatedHoursAgo: 5 })] }),
      ],
    }),
  ];

  return hydrate(specs, { workspaceId: WORKSPACE_ID, parentId: null, idPrefix: "d" });
}

const ID = {
  api: "d_platform_api_catalogue",
  task: "d_platform_task_board",
  config: "d_platform_service_config",
  secret: "d_platform_service_secrets",
} as const;

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  boardService.reset();
  devtoolsService.reset();

  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildDevTree() },
    selectedIds: [],
    feedback: null,
    seed: 0,
  });
});

/* ------------------------------------------------------------- templates */

describe("board templates", () => {
  test("every template names a primary column it actually declares", () => {
    for (const template of BOARD_TEMPLATES) {
      const primary = template.columns.find((column) => column.id === template.primaryColumnId);

      expect(primary, template.id).toBeDefined();
      expect(primary?.isPrimary).toBe(true);
      expect(template.rowIdPrefix.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("a board generated from a template cannot reach back into it", () => {
    const template = templateById("task")!;
    const columns = instantiateColumns(template);

    // Nothing the board holds is the same object the template holds.
    expect(columns[0]).not.toBe(template.columns[0]);

    const status = columns.find((column) => column.id === "col_status");
    const templateStatus = template.columns.find((column) => column.id === "col_status");
    if (status?.type !== "select" || templateStatus?.type !== "select") throw new Error("fixture");

    expect(status.config.options).not.toBe(templateStatus.config.options);
    expect(status.config.options[0]).not.toBe(templateStatus.config.options[0]);
  });

  test("the frozen catalogue refuses an in-place edit", () => {
    const template = templateById("bug")!;

    expect(() => {
      // @ts-expect-error — deliberately breaking the readonly contract.
      template.name = "Changed";
    }).toThrow();
  });

  test("environment labels are defined once and shared", () => {
    const bug = templateById("bug")!;
    const qa = templateById("qa")!;

    for (const template of [bug, qa]) {
      const env = template.columns.find((column) => column.id === "col_env");
      expect(env?.type === "select" && env.config.options.map((option) => option.label)).toEqual([
        "Development",
        "Staging",
        "Production",
      ]);
    }

    expect(ENVIRONMENT_OPTIONS.find((option) => option.id === PRODUCTION_OPTION_ID)?.label).toBe(
      "Production",
    );
  });

  test("every HTTP verb carries its own colour", () => {
    const colors = new Set(METHOD_OPTIONS.map((option) => option.color));

    expect(METHOD_OPTIONS.map((option) => option.label)).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ]);
    expect(colors.size).toBe(METHOD_OPTIONS.length);
  });

  test("a board built from a template carries its prefix and schema", async () => {
    const snapshot = await boardService.getBoard(ID.api);

    expect(snapshot.board.rowIdPrefix).toBe("API");
    expect(snapshot.board.templateId).toBe("apiDocs");
    expect(snapshot.rows[0]?.displayId).toBe("API-001");
    expect(snapshot.board.columns.map((column) => column.id)).toContain("col_method");
  });

  test("deleting a column from a board leaves the template intact", async () => {
    const snapshot = await boardService.getBoard(ID.task);
    await boardService.deleteColumn(snapshot.board.id, "col_priority");

    const after = await boardService.getBoard(ID.task);
    expect(after.board.columns.some((column) => column.id === "col_priority")).toBe(false);

    expect(templateById("task")!.columns.some((column) => column.id === "col_priority")).toBe(true);
  });
});

/* ------------------------------------------------------- API duplicates */

describe("API documentation duplicates", () => {
  test("the same endpoint and method twice is reported", async () => {
    const snapshot = await boardService.getBoard(ID.api);
    const pair = apiColumns(snapshot.board, snapshot.board.columns);
    if (!pair) throw new Error("expected an API board");

    const index = indexRows(snapshot.rows);
    const report = findDuplicateEndpoints(index.rowOrder, index.rowsById, pair.endpoint, pair.method);

    expect(report.groups.length).toBeGreaterThan(0);
    expect(report.rowIds.size).toBeGreaterThanOrEqual(report.groups.length * 2);

    for (const group of report.groups) {
      expect(group.rowIds.length).toBeGreaterThan(1);
      expect(group.method).toBe(group.method.toUpperCase());
    }
  });

  test("rows missing an endpoint or a method are incomplete, not duplicates", async () => {
    const snapshot = await boardService.getBoard(ID.api);
    const pair = apiColumns(snapshot.board, snapshot.board.columns)!;

    const rows = [
      { ...snapshot.rows[0]!, id: "r1", cells: { ...snapshot.rows[0]!.cells, [pair.endpoint.id]: { kind: "text" as const, value: "" } } },
      { ...snapshot.rows[1]!, id: "r2", cells: { ...snapshot.rows[1]!.cells, [pair.endpoint.id]: { kind: "text" as const, value: "" } } },
    ];
    const index = indexRows(rows);

    expect(
      findDuplicateEndpoints(index.rowOrder, index.rowsById, pair.endpoint, pair.method).groups,
    ).toHaveLength(0);
  });

  test("a board that is not an API catalogue has nothing to check", async () => {
    const snapshot = await boardService.getBoard(ID.task);

    expect(apiColumns(snapshot.board, snapshot.board.columns)).toBeNull();
  });
});

/* -------------------------------------------------------------- config */

describe("config documents", () => {
  test("JSON is validated with a position", () => {
    expect(lintJson('{"a": 1}')).toBeNull();
    expect(lintJson("")).toBeNull();

    const problem = lintJson('{\n  "a": 1,\n  "b" 2\n}');
    expect(problem).not.toBeNull();
    expect(problem!.line).toBeGreaterThan(1);
    expect(problem!.message).not.toContain("position");
  });

  test("formatting leaves broken JSON alone", () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}\n');
    expect(formatJson("{oops")).toBe("{oops");
  });

  test("the tokeniser knows the three dialects", () => {
    const json = tokenizeLine('  "port": 6868,', "json");
    expect(json.some((token) => token.kind === "key")).toBe(true);
    expect(json.some((token) => token.kind === "number")).toBe(true);

    const env = tokenizeLine("API_URL=https://api.nexdrop.vn", "env");
    expect(env[1]).toMatchObject({ kind: "key", text: "API_URL" });

    expect(tokenizeLine("# a comment", "env")[0]?.kind).toBe("comment");
    expect(tokenizeLine("port: 6868", "yaml").some((token) => token.kind === "number")).toBe(true);
    expect(tokenize("a\nb", "env")).toHaveLength(2);
    expect(formatFromName("service.json")).toBe("json");
    expect(formatFromName("compose.yaml")).toBe("yaml");
    expect(formatFromName(".env.local")).toBe("env");
  });

  test("every save becomes a version, and restoring adds another", async () => {
    const original = await devtoolsService.getConfig(ID.config);
    expect(original.version).toBe(1);

    await devtoolsService.saveConfig({ nodeId: ID.config, content: "PORT=7000\n" });
    const second = await devtoolsService.saveConfig({ nodeId: ID.config, content: "PORT=8000\n" });

    expect(second.version).toBe(3);
    expect((await devtoolsService.listConfigVersions(ID.config))).toHaveLength(3);

    const versions = await devtoolsService.listConfigVersions(ID.config);
    const target = versions.find((version) => version.version === 2)!;
    const restored = await devtoolsService.restoreConfigVersion(ID.config, target.id);

    // History is appended to, never rewound.
    expect(restored.content).toBe("PORT=7000\n");
    expect(restored.version).toBe(4);
    expect(await devtoolsService.listConfigVersions(ID.config)).toHaveLength(4);
  });

  test("the environment can be changed without touching the content", async () => {
    const before = await devtoolsService.getConfig(ID.config);

    const after = await devtoolsService.saveConfig({
      nodeId: ID.config,
      content: before.content,
      environmentOptionId: PRODUCTION_OPTION_ID,
    });

    expect(after.environmentOptionId).toBe(PRODUCTION_OPTION_ID);
    expect(after.content).toBe(before.content);
  });

  test("a failed save leaves the stored document alone", async () => {
    const before = await devtoolsService.getConfig(ID.config);
    setSimulation({ failSaves: true });

    await expect(
      devtoolsService.saveConfig({ nodeId: ID.config, content: "broken" }),
    ).rejects.toThrow();

    resetSimulation();
    setSimulation({ latency: "fast" });
    expect((await devtoolsService.getConfig(ID.config)).content).toBe(before.content);
  });
});

/* -------------------------------------------------------------- secrets */

describe("secret documents", () => {
  test("the document only ever carries masks", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const serialised = JSON.stringify(document);

    expect(document.entries.length).toBeGreaterThan(0);
    for (const entry of document.entries) {
      expect(entry.maskedValue).toMatch(/^•+$/);
      expect(Object.keys(entry)).not.toContain("value");
    }

    // No plaintext anywhere in the payload the client receives.
    expect(serialised).not.toContain("pg-3f9c");
    expect(serialised).not.toContain("sk_live");
  });

  test("an admin can reveal, and the reveal is audited", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const entry = document.entries[0]!;

    const value = await devtoolsService.revealSecret({
      nodeId: ID.secret,
      secretId: entry.id,
      role: "admin",
      action: "reveal",
    });

    expect(value.length).toBeGreaterThan(0);

    const audit = await devtoolsService.listSecretAudit(ID.secret);
    expect(audit[0]).toMatchObject({ action: "reveal", key: entry.key });
    expect(audit[0]?.ip).toBeTruthy();
    expect(audit[0]?.at).toBeTruthy();
  });

  test("a member is refused, and the attempt is still recorded", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const entry = document.entries[0]!;

    await expect(
      devtoolsService.revealSecret({
        nodeId: ID.secret,
        secretId: entry.id,
        role: "member",
        action: "reveal",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      return message.includes("Admin");
    });

    const audit = await devtoolsService.listSecretAudit(ID.secret);
    expect(audit).toHaveLength(1);
    expect(audit[0]?.ip).toContain("denied");
  });

  test("copying goes through the same gate as revealing", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const entry = document.entries[1]!;

    await devtoolsService.revealSecret({
      nodeId: ID.secret,
      secretId: entry.id,
      role: "admin",
      action: "copy",
    });

    expect((await devtoolsService.listSecretAudit(ID.secret))[0]?.action).toBe("copy");

    await expect(
      devtoolsService.revealSecret({
        nodeId: ID.secret,
        secretId: entry.id,
        role: "viewer",
        action: "copy",
      }),
    ).rejects.toThrow();
  });

  test("an unknown secret is a not-found, not a leak", async () => {
    await expect(
      devtoolsService.revealSecret({
        nodeId: ID.secret,
        secretId: "nope",
        role: "admin",
        action: "reveal",
      }),
    ).rejects.toThrow();
  });
});

/* ------------------------------------------------------------ relations */

describe("relations and backlinks", () => {
  test("boards are listable without loading their records", async () => {
    const boards = await boardService.listBoards();

    expect(boards.map((entry) => entry.name)).toEqual(["API Catalogue", "Task Board"]);
    expect(boards[0]?.boardId).toBe(`brd_${ID.api}`);
  });

  test("a relation index resolves display ids across boards", async () => {
    const targets = await boardService.relationIndex(`brd_${ID.task}`);

    expect(targets).toHaveLength(4);
    expect(targets[0]?.displayId).toBe("TASK-001");
    expect(targets[0]?.boardName).toBe("Task Board");
  });

  test("linking a row surfaces a backlink on the target", async () => {
    const api = await boardService.getBoard(ID.api);
    const task = await boardService.getBoard(ID.task);

    const source = api.rows[0]!;
    const target = task.rows[0]!;

    await boardService.updateCells({
      boardId: api.board.id,
      edits: [
        { rowId: source.id, columnId: "col_task", value: { kind: "relation", rowIds: [target.id] } },
      ],
    });

    const backlinks = await boardService.listBacklinks(target.id);

    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]).toMatchObject({
      boardName: "API Catalogue",
      columnName: "Related task",
      displayId: source.displayId,
    });
  });

  test("a target that no longer resolves renders as a deleted item", () => {
    const column: BoardColumnOf<"relation"> = {
      id: "col_rel",
      name: "Blocked by",
      type: "relation",
      position: 0,
      width: 180,
      hidden: false,
      isPrimary: false,
      config: { boardId: "brd_x", displayColumnId: null, isMulti: true },
    };

    const resolved = cellText({ kind: "relation", rowIds: ["gone"] }, column, {
      relationLabels: new Map(),
      relationResolved: true,
    });
    const pending = cellText({ kind: "relation", rowIds: ["gone"] }, column, {
      relationLabels: new Map(),
      relationResolved: false,
    });

    expect(resolved).toBe(DELETED_LABEL);
    expect(pending).toBe("gone");
  });
});

/* --------------------------------------------------------------- embed */

describe("embedded board views", () => {
  test("an embed resolves a board and a saved view by id", async () => {
    const snapshot = await boardService.getBoard(ID.task);

    expect(snapshot.board.views.length).toBeGreaterThan(0);
    expect(snapshot.board.views[0]?.boardId).toBe(snapshot.board.id);
  });

  test("a board node that is gone is a not-found the embed can render", async () => {
    await expect(boardService.getBoard("d_missing_board")).rejects.toSatisfy((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      return message.toLowerCase().includes("could not be found");
    });
  });
});
