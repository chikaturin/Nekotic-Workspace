"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DriveView } from "@/components/drive/drive-view";
import { FilesView } from "@/components/files/files-view";
import { AppShell } from "@/components/layout/app-shell";
import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { chainOf } from "@/lib/exported-routes";

/**
 * The static host's fallback page, doing something useful.
 *
 * `output: export` writes a file per known path, and the host answers anything
 * else with `404.html` — which is this page. A workspace URL landing here is
 * almost never a typo: it is a folder, page or board whose address did not
 * exist when the site was built. Rendering the app for it turns a dead end
 * back into the workspace, addressed at whatever the URL asked for; the view
 * itself reports honestly when there is no such node.
 *
 * Anything that is not a workspace route still gets a plain 404.
 */
function subscribe(): () => void {
  return () => {};
}

const serverSnapshot = (): string | null => null;

export function NotFoundFallback() {
  // Read after hydration only: the prerendered HTML has no URL to look at, so
  // 404.html ships as the message and becomes the workspace on the client.
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    serverSnapshot,
  );

  const target = path === null ? null : chainOf(path);

  if (target?.root === DRIVE_ROOT_PATH) {
    return (
      <AppShell>
        <DriveView segments={target.chain} />
      </AppShell>
    );
  }

  if (target?.root === FILES_ROOT_PATH) {
    return (
      <AppShell>
        <FilesView segments={target.chain} />
      </AppShell>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="metric text-[11px] uppercase tracking-widest text-faint-foreground">404</p>
      <h1 className="text-lg font-semibold text-foreground">This page does not exist</h1>
      <Link
        href={DRIVE_ROOT_PATH}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to Drive
      </Link>
    </div>
  );
}
