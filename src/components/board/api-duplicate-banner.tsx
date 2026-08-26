"use client";

import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGridStore } from "@/store/grid-store";
import type { DuplicateReport } from "@/lib/api-catalog";

/**
 * DV-API-20 warning. Duplicates are surfaced, never blocked: the catalogue may
 * legitimately hold a draft of an endpoint while it is being replaced.
 */
export function ApiDuplicateBanner({ report }: { report: DuplicateReport }) {
  if (report.groups.length === 0) return null;

  const openDrawer = useGridStore.getState().openDrawer;

  return (
    <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
        <TriangleAlert className="size-3.5" />
        {report.groups.length} endpoint {report.groups.length === 1 ? "pair is" : "pairs are"}{" "}
        documented more than once
      </p>

      <ul className="mt-1 flex flex-wrap gap-1.5">
        {report.groups.map((group) => (
          <li key={group.key}>
            <button
              type="button"
              onClick={() => {
                const first = group.rowIds[0];
                if (first) openDrawer(first);
              }}
              className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-background px-2 py-0.5 text-[11px] hover:border-warning"
            >
              <Badge variant="default" className="border-0 bg-transparent p-0">
                {group.method}
              </Badge>
              <span className="metric text-muted-foreground">{group.endpoint}</span>
              <span className="metric text-faint-foreground">×{group.rowIds.length}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
