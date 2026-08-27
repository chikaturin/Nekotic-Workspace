import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { BASE_PATH } from "@/config/base-path";
import { nodePathChains } from "@/lib/static-paths";

/**
 * What the static export can actually serve.
 *
 * `output: export` writes one HTML file per path known at build time, so a
 * node created, renamed or moved *after* the build has an address the host has
 * never heard of. Asking for it is a full page load into the host's 404, which
 * on a client-only workspace also throws away the record that was just made.
 *
 * The way out is not to invent files: it is to address those nodes through a
 * route that does exist. `/drive/?p=a/b/c` is served by the prerendered Drive
 * root, and the view resolves the chain from the query — so navigation stays a
 * soft one and nothing is lost.
 *
 * Paths the build did write keep their clean URLs, unchanged.
 */

const SECTION_ROOTS: readonly string[] = [DRIVE_ROOT_PATH, FILES_ROOT_PATH];

/**
 * Slug chain the route is asking for, or null when it is not a node route.
 *
 * Accepts both forms it is handed: app-relative hrefs built by `hrefForNode`,
 * and `window.location.pathname`, which carries the deployment's base path.
 */
export function chainOf(href: string): { root: string; chain: readonly string[] } | null {
  const [raw = ""] = href.split(/[?#]/);
  const path =
    BASE_PATH.length > 0 && (raw === BASE_PATH || raw.startsWith(`${BASE_PATH}/`))
      ? raw.slice(BASE_PATH.length) || "/"
      : raw;

  const root = SECTION_ROOTS.find(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`),
  );
  if (!root) return null;

  const rest = path.slice(root.length).replace(/^\/|\/$/g, "");
  return { root, chain: rest.length === 0 ? [] : rest.split("/").map(decodeURIComponent) };
}

let exported: Set<string> | null = null;

/** Memoised: the chains `generateStaticParams` handed the exporter. */
function exportedChains(): ReadonlySet<string> {
  exported ??= new Set(nodePathChains().map((chain) => chain.join("/")));
  return exported;
}

/** True when the host has a file for this path. */
export function isExportedRoute(href: string): boolean {
  const target = chainOf(href);
  // Anything outside the node sections is a plain static page.
  if (!target) return true;
  return exportedChains().has(target.chain.join("/"));
}

/** The query form of a node route: `/drive/?p=a/b/c`. */
export function queryRouteFor(href: string): string {
  const target = chainOf(href);
  if (!target || target.chain.length === 0) return href;

  return `${target.root}/?p=${encodeURIComponent(target.chain.join("/"))}`;
}

/**
 * The href to navigate to for `href`: itself when the export covers it, its
 * query form when it does not.
 */
export function routableHref(href: string): string {
  return isExportedRoute(href) ? href : queryRouteFor(href);
}

/** The chain a `?p=` search string is asking for. */
export function chainFromSearch(search: string): readonly string[] | null {
  const raw = new URLSearchParams(search).get("p");
  if (raw === null) return null;

  const trimmed = raw.replace(/^\/|\/$/g, "");
  return trimmed.length === 0 ? [] : trimmed.split("/").map(decodeURIComponent);
}
