import Link from "next/link";
import { DRIVE_ROOT_PATH } from "@/config/app";

export default function NotFound() {
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
