import { DRIVE_ROOT_PATH } from "@/config/app";
import { buildHref } from "@/lib/tree";
import { childrenOf, isContainer, type BreadcrumbTrail, type DriveNode, type Workspace } from "@/types";

/**
 * Build the header trail: workspace root first, then every ancestor, then the
 * current node. Each crumb carries its sibling containers so the dropdown can
 * jump laterally without a round trip.
 */
export function buildBreadcrumbs(
  workspace: Workspace,
  tree: readonly DriveNode[],
  ancestors: readonly DriveNode[],
  node: DriveNode | null,
): BreadcrumbTrail {
  const chain: readonly DriveNode[] = node ? [...ancestors, node] : ancestors;

  const rootCrumb = {
    id: workspace.id,
    label: workspace.name,
    href: DRIVE_ROOT_PATH,
    kind: "workspace" as const,
    isCurrent: chain.length === 0,
    siblings: [] as { id: string; label: string; href: string }[],
  };

  const crumbs = chain.map((current, index) => {
    const path = chain.slice(0, index + 1);
    const parent = index === 0 ? null : chain[index - 1];
    const pool = parent ? childrenOf(parent) : tree;

    const siblings = pool
      .filter((candidate) => isContainer(candidate) && candidate.id !== current.id)
      .map((candidate) => ({
        id: candidate.id,
        label: candidate.name,
        href: buildHref([...path.slice(0, -1), candidate]),
      }));

    return {
      id: current.id,
      label: current.name,
      href: buildHref(path),
      kind: current.type,
      isCurrent: index === chain.length - 1,
      siblings,
    };
  });

  return [rootCrumb, ...crumbs];
}
