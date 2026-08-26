import { describe, expect, test } from "vitest";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { resolvePath } from "@/lib/tree";
import { WORKSPACES } from "@/mock/workspaces";
import type { Workspace } from "@/types";
import { buildTestTree } from "./helpers";

const workspace = WORKSPACES[0] as Workspace;

function trailFor(segments: readonly string[]) {
  const tree = buildTestTree();
  const location = resolvePath(tree, segments);
  return buildBreadcrumbs(workspace, tree, location.ancestors, location.node);
}

describe("buildBreadcrumbs", () => {
  test("renders workspace / project / folder / folder for a deep path", () => {
    const trail = trailFor(["development", "backend", "payment"]);

    expect(trail.map((crumb) => crumb.label)).toEqual([
      "NexDrop",
      "Development",
      "Backend",
      "Payment",
    ]);
  });

  test("marks only the last crumb as current", () => {
    const trail = trailFor(["development", "backend"]);

    expect(trail.filter((crumb) => crumb.isCurrent)).toHaveLength(1);
    expect(trail[trail.length - 1]?.isCurrent).toBe(true);
  });

  test("the workspace root is current when no node is selected", () => {
    const trail = trailFor([]);

    expect(trail).toHaveLength(1);
    expect(trail[0]?.isCurrent).toBe(true);
  });

  test("each crumb links to its own absolute path", () => {
    const trail = trailFor(["development", "backend", "payment"]);

    expect(trail.map((crumb) => crumb.href)).toEqual([
      "/drive",
      "/drive/development",
      "/drive/development/backend",
      "/drive/development/backend/payment",
    ]);
  });

  test("crumbs expose sibling containers for lateral navigation", () => {
    const trail = trailFor(["development", "backend"]);
    const backend = trail[2];

    expect(backend?.siblings.map((sibling) => sibling.label)).toEqual(["Frontend"]);
    expect(backend?.siblings[0]?.href).toBe("/drive/development/frontend");
  });

  test("leaf crumbs carry the node type", () => {
    const trail = trailFor(["development", "backend", "roadmap"]);

    expect(trail[trail.length - 1]?.kind).toBe("board");
  });
});
