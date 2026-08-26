import { beforeEach, describe, expect, test } from "vitest";
import {
  AUDIT_MODULES,
  AUDIT_MODULE_LABELS,
  SEVERITIES,
  auditActionLabel,
  auditTimestamp,
  describeAuditEvent,
  matchesSearch,
} from "@/lib/audit";
import { doc, folder, hydrate, project, type NodeSpec } from "@/mock/factory";
import { CURRENT_USER, memberAt } from "@/mock/users";
import { auditService } from "@/services/audit-service";
import { devtoolsService } from "@/services/devtools-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { usePermissionStore } from "@/store/permission-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AuditEvent, DriveNode } from "@/types";

/**
 * Audit log (SY-AUD-41).
 *
 * The property that matters is negative: there is no way to change what was
 * recorded. The first test asserts the shape of the service itself, because a
 * missing capability is the only kind of guarantee a UI cannot undo.
 */

const WORKSPACE_ID = "ws_audit";

function buildTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Platform",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        folder({ name: "Backend", updatedHoursAgo: 2, children: [] }),
        doc({
          name: "Service secrets",
          documentKind: "secret",
          icon: "🔐",
          blockCount: 0,
          excerpt: "",
          updatedHoursAgo: 3,
        }),
      ],
    }),
  ];

  return hydrate(specs, { workspaceId: WORKSPACE_ID, parentId: null, idPrefix: "a" });
}

const ID = {
  platform: "a_platform",
  backend: "a_platform_backend",
  secret: "a_platform_service_secrets",
} as const;

const nodeAt = (id: string, tree: readonly DriveNode[]): DriveNode => {
  const flat = (nodes: readonly DriveNode[]): readonly DriveNode[] =>
    nodes.flatMap((node) => [node, ...flat("children" in node ? node.children : [])]);
  const found = flat(tree).find((node) => node.id === id);
  if (!found) throw new Error(`fixture missing: ${id}`);
  return found;
};

let tree: readonly DriveNode[] = buildTree();

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  auditService.reset();
  devtoolsService.reset();
  usePermissionStore.getState().reset();

  tree = buildTree();
  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: tree },
    feedback: null,
    seed: 0,
  });
});

describe("the service surface", () => {
  test("appends and reads, and offers nothing else", () => {
    expect(Object.keys(auditService).sort()).toEqual(["list", "record", "reset"]);
  });

  test("a recorded event cannot be reached to be changed", async () => {
    auditService.record({
      module: "board",
      action: "board.export",
      actor: CURRENT_USER,
      target: "Roadmap",
    });

    const page = await auditService.list();
    const first = page.events[0] as AuditEvent;

    // The list is a copy of the store's array — mutating it changes nothing.
    (page.events as AuditEvent[]).length = 0;
    expect((await auditService.list()).events[0]?.id).toBe(first.id);
  });
});

describe("reading the trail", () => {
  test("the newest entry is first", async () => {
    auditService.record({ module: "row", action: "row.update", actor: CURRENT_USER });
    const page = await auditService.list();

    expect(page.events[0]?.action).toBe("row.update");
    expect(Date.parse(page.events[0]!.at)).toBeGreaterThanOrEqual(Date.parse(page.events[1]!.at));
  });

  test("severity defaults to error on a refusal and info otherwise", () => {
    const denied = auditService.record({
      module: "secret",
      action: "secret.reveal",
      actor: memberAt(1),
      outcome: "denied",
    });
    const allowed = auditService.record({ module: "row", action: "row.create", actor: CURRENT_USER });

    expect(denied.severity).toBe("error");
    expect(allowed.severity).toBe("info");
  });

  test("filters narrow by module, severity and actor", async () => {
    const byModule = await auditService.list({ module: "secret" });
    expect(byModule.events.every((event) => event.module === "secret")).toBe(true);
    expect(byModule.total).toBeGreaterThan(0);

    const bySeverity = await auditService.list({ severity: "error" });
    expect(bySeverity.events.every((event) => event.severity === "error")).toBe(true);

    const byActor = await auditService.list({ actorId: "usr_hai" });
    expect(byActor.events.every((event) => event.actor.id === "usr_hai")).toBe(true);
  });

  test("the severity tally counts the matches, not the page", async () => {
    const page = await auditService.list({ limit: 2 });
    const tallied = page.bySeverity.info + page.bySeverity.warn + page.bySeverity.error;

    expect(page.events).toHaveLength(2);
    expect(tallied).toBe(page.total);
  });

  test("search reaches every column the table shows", async () => {
    const byTarget = await auditService.list({ search: "STRIPE_SECRET_KEY" });
    const byAddress = await auditService.list({ search: "10.4.31" });

    expect(byTarget.total).toBeGreaterThan(0);
    expect(byAddress.total).toBeGreaterThan(0);
  });

  test("an empty backend is an empty page, not an error", async () => {
    setSimulation({ listFailure: "empty" });
    const page = await auditService.list();

    expect(page.events).toEqual([]);
    expect(page.total).toBe(0);
  });

  test("a failing backend rejects rather than returning half a trail", async () => {
    setSimulation({ listFailure: "network" });
    await expect(auditService.list()).rejects.toThrow();
  });
});

describe("what a row says", () => {
  const event: AuditEvent = {
    id: "aud_1",
    at: "2026-08-26T09:20:00.000Z",
    module: "board",
    action: "board.column.create",
    actor: CURRENT_USER,
    ip: "10.4.19.22",
    severity: "info",
    target: "Roadmap",
    detail: "Column “Owner” added.",
    outcome: "allowed",
  };

  test("an action that is a permission key reads as its catalogue label", () => {
    expect(auditActionLabel("board.column.create")).toBe("Create columns");
  });

  test("an action outside the catalogue is still humanised, never left raw", () => {
    expect(auditActionLabel("system.retention.sweep")).toBe("Retention sweep");
  });

  test("the timestamp is absolute — an audit row is evidence, not a feed item", () => {
    expect(auditTimestamp(event.at)).toContain("2026");
    expect(auditTimestamp(event.at)).toContain("·");
  });

  test("the description is a sentence, and never the payload", () => {
    const described = describeAuditEvent(event);

    expect(described).toContain(CURRENT_USER.name);
    expect(described).toContain("Roadmap");
    expect(described).not.toContain("{");
  });

  test("every module the log can file under has a label", () => {
    for (const name of AUDIT_MODULES) {
      expect(AUDIT_MODULE_LABELS[name]?.length ?? 0).toBeGreaterThan(0);
    }
    expect(SEVERITIES).toHaveLength(3);
  });

  test("an empty search matches everything", () => {
    expect(matchesSearch(event, "   ")).toBe(true);
    expect(matchesSearch(event, "nothing like this")).toBe(false);
  });
});

describe("what reaches the trail", () => {
  test("a refused reveal is recorded exactly as carefully as an allowed one", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const entry = document.entries[0]!;

    await expect(
      devtoolsService.revealSecret({
        nodeId: ID.secret,
        secretId: entry.id,
        role: "member",
        action: "reveal",
      }),
    ).rejects.toThrow();

    const page = await auditService.list({ module: "secret" });
    const recorded = page.events[0]!;

    expect(recorded.outcome).toBe("denied");
    expect(recorded.severity).toBe("error");
    expect(recorded.target).toBe(entry.key);
  });

  test("an allowed reveal lands as a warning, not as routine traffic", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const entry = document.entries[0]!;

    await devtoolsService.revealSecret({
      nodeId: ID.secret,
      secretId: entry.id,
      role: "admin",
      action: "reveal",
    });

    const page = await auditService.list({ module: "secret" });

    expect(page.events[0]?.outcome).toBe("allowed");
    expect(page.events[0]?.severity).toBe("warn");
  });

  test("writing an access rule is audited, and so is taking it away", async () => {
    const backend = nodeAt(ID.backend, tree);
    const store = usePermissionStore.getState();

    store.setAccessRule(WORKSPACE_ID, backend, { kind: "user", userId: "usr_duc" }, "manager");
    store.clearAccessRule(WORKSPACE_ID, backend, { kind: "user", userId: "usr_duc" });

    const page = await auditService.list({ module: "workspace", search: "Backend" });

    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.events[0]?.detail).toContain("inherits");
    expect(page.events[1]?.detail).toContain("Manager");
  });

  test("clearing a rule that is not there records nothing", async () => {
    const backend = nodeAt(ID.backend, tree);
    const before = (await auditService.list({ module: "workspace" })).total;

    usePermissionStore
      .getState()
      .clearAccessRule(WORKSPACE_ID, backend, { kind: "user", userId: "usr_lan" });

    expect((await auditService.list({ module: "workspace" })).total).toBe(before);
  });
});
