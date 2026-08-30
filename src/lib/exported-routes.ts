import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { nodePathChains } from "@/lib/static-paths";

const SECTION_ROOTS: readonly string[] = [DRIVE_ROOT_PATH, FILES_ROOT_PATH];

export function chainOf(
  href: string,
): { root: string; chain: readonly string[] } | null {
  const [path = ""] = href.split(/[?#]/);

  const root = SECTION_ROOTS.find(
    (candidate) => path === candidate || path.startsWith(`${candidate}/`),
  );
  if (!root) return null;

  const rest = path.slice(root.length).replace(/^\/|\/$/g, "");
  return {
    root,
    chain: rest.length === 0 ? [] : rest.split("/").map(decodeURIComponent),
  };
}

let exported: Set<string> | null = null;

function exportedChains(): ReadonlySet<string> {
  exported ??= new Set(nodePathChains().map((chain) => chain.join("/")));
  return exported;
}

export function isExportedRoute(href: string): boolean {
  const target = chainOf(href);
  if (!target) return true;
  return exportedChains().has(target.chain.join("/"));
}

export function queryRouteFor(href: string): string {
  const target = chainOf(href);
  if (!target || target.chain.length === 0) return href;

  return `${target.root}/?p=${encodeURIComponent(target.chain.join("/"))}`;
}

export function routableHref(href: string): string {
  return isExportedRoute(href) ? href : queryRouteFor(href);
}

export function chainFromSearch(search: string): readonly string[] | null {
  const raw = new URLSearchParams(search).get("p");
  if (raw === null) return null;

  const trimmed = raw.replace(/^\/|\/$/g, "");
  return trimmed.length === 0 ? [] : trimmed.split("/").map(decodeURIComponent);
}
