"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import type { AuditFilters as Filters } from "@/hooks/use-audit-log";
import { AUDIT_MODULES, AUDIT_MODULE_LABELS, SEVERITIES, SEVERITY_LABELS } from "@/lib/audit";
import { MEMBERS } from "@/mock/users";
import type { AuditModule, AuditSeverity } from "@/types";

interface AuditFiltersProps {
  readonly filters: Filters;
  readonly isFiltered: boolean;
  readonly onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  readonly onClear: () => void;
}

/** Narrowing the trail. Filtering is the only thing anyone can do to it. */
export function AuditFilters({ filters, isFiltered, onChange, onClear }: AuditFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <div className="relative min-w-52 flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" />
        <Input
          value={filters.search}
          aria-label="Search the audit log"
          placeholder="Search actor, action, target or address"
          onChange={(event) => onChange("search", event.target.value)}
          className="h-7 pl-7 text-ui"
        />
      </div>

      <SelectField
        value={filters.module}
        aria-label="Filter by module"
        onChange={(event) => onChange("module", event.target.value as AuditModule | "all")}
      >
        <option value="all">All modules</option>
        {AUDIT_MODULES.map((module) => (
          <option key={module} value={module}>
            {AUDIT_MODULE_LABELS[module]}
          </option>
        ))}
      </SelectField>

      <SelectField
        value={filters.severity}
        aria-label="Filter by severity"
        onChange={(event) => onChange("severity", event.target.value as AuditSeverity | "all")}
      >
        <option value="all">All severities</option>
        {SEVERITIES.map((severity) => (
          <option key={severity} value={severity}>
            {SEVERITY_LABELS[severity]}
          </option>
        ))}
      </SelectField>

      <SelectField
        value={filters.actorId}
        aria-label="Filter by actor"
        onChange={(event) => onChange("actorId", event.target.value)}
      >
        <option value="all">Anyone</option>
        {MEMBERS.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </SelectField>

      {isFiltered && (
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onClear}>
          <X />
          Clear
        </Button>
      )}
    </div>
  );
}
