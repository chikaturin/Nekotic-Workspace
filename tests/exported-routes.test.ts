import { describe, expect, test } from "vitest";
import {
  chainFromSearch,
  chainOf,
  isExportedRoute,
  queryRouteFor,
  routableHref,
} from "@/lib/exported-routes";
import { nodePathChains } from "@/lib/static-paths";

/**
 * `output: export` writes a file per path known at build time. Anything the
 * workspace grows afterwards has to be addressed through a path that *was*
 * written, or the host answers with its 404 and the client state goes with it.
 */

const EXPORTED = nodePathChains()
  .filter((chain) => chain.length > 0)
  .map((chain) => chain.join("/"));

const first = EXPORTED[0];
if (first === undefined) throw new Error("the mock tree exported no chains");

describe("reading a route", () => {
  test("splits a drive path into its root and slug chain", () => {
    expect(chainOf("/drive/development/backend")).toEqual({
      root: "/drive",
      chain: ["development", "backend"],
    });
  });

  test("a trailing slash reads the same as none", () => {
    expect(chainOf("/drive/development/")).toEqual({
      root: "/drive",
      chain: ["development"],
    });
  });

  test("reads the files section as well as drive", () => {
    expect(chainOf("/files/research")?.root).toBe("/files");
  });

  test("the section root itself is an empty chain, not a missing one", () => {
    expect(chainOf("/drive")).toEqual({ root: "/drive", chain: [] });
  });

  test("a page outside the node sections is not a node route", () => {
    expect(chainOf("/dashboard")).toBeNull();
    expect(chainOf("/archive")).toBeNull();
  });

  test("query and hash are not part of the path", () => {
    expect(chainOf("/drive/development?p=x#y")?.chain).toEqual(["development"]);
  });

  test("decodes escaped slugs", () => {
    expect(chainOf("/drive/a%20b")?.chain).toEqual(["a b"]);
  });
});

describe("what the export covers", () => {
  test("every chain the exporter was given is servable", () => {
    for (const chain of EXPORTED) expect(isExportedRoute(`/drive/${chain}`)).toBe(true);
  });

  test("plain static pages are servable", () => {
    expect(isExportedRoute("/dashboard")).toBe(true);
    expect(isExportedRoute("/drive")).toBe(true);
  });

  test("a node created after the build is not", () => {
    expect(isExportedRoute("/drive/untitled")).toBe(false);
    expect(isExportedRoute(`/drive/${first}/untitled`)).toBe(false);
  });
});

describe("addressing what the export missed", () => {
  test("an unexported node routes through the prerendered section root", () => {
    expect(routableHref("/drive/untitled")).toBe("/drive/?p=untitled");
    expect(routableHref("/files/a/b")).toBe("/files/?p=a%2Fb");
  });

  test("an exported node keeps its clean URL", () => {
    expect(routableHref(`/drive/${first}`)).toBe(`/drive/${first}`);
  });

  test("the section root is already routable", () => {
    expect(queryRouteFor("/drive")).toBe("/drive");
  });

  test("the query form round-trips back to the same chain", () => {
    const chain = ["development", "a b", "new page"];
    const href = routableHref(`/drive/${chain.map(encodeURIComponent).join("/")}`);

    expect(chainFromSearch(href.split("?")[1] ?? "")).toEqual(chain);
  });

  test("a search string without the parameter asks for nothing", () => {
    expect(chainFromSearch("?view=grid")).toBeNull();
    expect(chainFromSearch("")).toBeNull();
  });

  test("an empty parameter is the section root, not a one-segment chain", () => {
    expect(chainFromSearch("?p=")).toEqual([]);
  });
});
