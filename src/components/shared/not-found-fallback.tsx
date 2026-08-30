"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { DriveView } from "@/components/drive/drive-view";
import { FilesView } from "@/components/files/files-view";
import { AppShell } from "@/components/layout/app-shell";
import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { chainOf } from "@/lib/exported-routes";

function subscribe(): () => void {
  return () => {};
}

const serverSnapshot = (): string | null => null;

export function NotFoundFallback() {
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
      <p className="metric text-body uppercase tracking-widest text-faint-foreground">404</p>
      <h1 className="text-display font-semibold text-foreground">This page does not exist</h1>
      <Link
        href={DRIVE_ROOT_PATH}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-lead text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to Drive
      </Link>
    </div>
  );
}
