"use client";

import { useCallback, useMemo, useState } from "react";
import { useAsyncResource, type AsyncResource } from "@/hooks/use-async-resource";
import { usePermissions } from "@/hooks/use-permissions";
import { auditService } from "@/services/audit-service";
import type { AuditModule, AuditPage, AuditQuery, AuditSeverity } from "@/types";

/**
 * The audit log, read-only (SY-AUD-41).
 *
 * The hook exposes filters and a reload and nothing else — there is no write
 * path here because there is none in the service either.
 */

export interface AuditFilters {
  readonly module: AuditModule | "all";
  readonly severity: AuditSeverity | "all";
  readonly actorId: string | "all";
  readonly search: string;
}

const INITIAL: AuditFilters = { module: "all", severity: "all", actorId: "all", search: "" };

export interface AuditLogController {
  readonly resource: AsyncResource<AuditPage>;
  readonly filters: AuditFilters;
  readonly setFilter: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => void;
  readonly clearFilters: () => void;
  readonly isFiltered: boolean;
  /** False when the role does not hold `workspace.audit.view`. */
  readonly canView: boolean;
}

export function useAuditLog(): AuditLogController {
  const can = usePermissions();
  const canView = can("workspace.audit.view");
  const [filters, setFilters] = useState<AuditFilters>(INITIAL);

  const query = useMemo<AuditQuery>(
    () => ({
      module: filters.module,
      severity: filters.severity,
      actorId: filters.actorId,
      search: filters.search,
    }),
    [filters],
  );

  const loader = useCallback(
    (signal: AbortSignal) => auditService.list(query, signal),
    [query],
  );

  const resource = useAsyncResource(loader, { enabled: canView, keepPreviousData: true });

  const setFilter = useCallback(
    <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    [],
  );

  const clearFilters = useCallback(() => setFilters(INITIAL), []);

  const isFiltered =
    filters.module !== "all" ||
    filters.severity !== "all" ||
    filters.actorId !== "all" ||
    filters.search.trim().length > 0;

  return { resource, filters, setFilter, clearFilters, isFiltered, canView };
}
