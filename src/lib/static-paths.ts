import { TREES_BY_WORKSPACE } from "@/mock/tree";
import { childrenOf, type DriveNode } from "@/types";

function collect(
  nodes: readonly DriveNode[],
  prefix: readonly string[],
  found: Set<string>,
): void {
  for (const node of nodes) {
    const path = [...prefix, node.slug];
    found.add(path.join("/"));
    collect(childrenOf(node), path, found);
  }
}

/**
 * Every slug chain the `[[...path]]` routes can be asked for.
 *
 * `output: export` writes one HTML file per param set, so a chain missing here
 * 404s on the static host before the client router ever sees it. The URL does
 * not name a workspace, so every workspace tree is walked and the chains are
 * unioned.
 *
 * `/files` gets the same list as `/drive`, leaves included: the toolbar links
 * to the file manager from a file's own page, and that URL has to reach the
 * app's own not-found state rather than the host's.
 */
export function nodePathChains(): readonly (readonly string[])[] {
  const found = new Set<string>();
  for (const tree of Object.values(TREES_BY_WORKSPACE)) collect(tree, [], found);
  // The empty chain is the root route itself — `/drive`, `/files`.
  return [[], ...[...found].sort().map((path) => path.split("/"))];
}
