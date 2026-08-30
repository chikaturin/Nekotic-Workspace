"use client";

import { Check, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABELS, ROLE_SUMMARIES, permissionsByModule, roleHas } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types";

export function RoleMatrix({ highlight }: { highlight?: WorkspaceRole | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-ui">
        <thead className="sticky top-0 z-sticky bg-elevated">
          <tr className="border-b border-border">
            <th scope="col" className="w-1/2 px-2 py-2 text-left font-medium text-muted-foreground">
              Permission
            </th>
            {WORKSPACE_ROLES.map((role) => (
              <th
                key={role}
                scope="col"
                className={cn(
                  "px-2 py-2 text-center font-medium",
                  role === highlight ? "text-accent" : "text-muted-foreground",
                )}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">{ROLE_SUMMARIES[role]}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>

        {permissionsByModule().map((group) => (
          <tbody key={group.module}>
            <tr>
              <th
                scope="colgroup"
                colSpan={WORKSPACE_ROLES.length + 1}
                className="bg-surface px-2 py-1 text-left text-micro font-semibold uppercase tracking-wider text-faint-foreground"
              >
                {group.label}
              </th>
            </tr>

            {group.permissions.map((permission) => (
              <tr key={permission.key} className="border-b border-hairline last:border-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  <span className="text-foreground">{permission.label}</span>
                  <span className="metric ml-1.5 text-micro text-faint-foreground">
                    {permission.key}
                  </span>
                </th>

                {WORKSPACE_ROLES.map((role) => {
                  const held = roleHas(role, permission.key);

                  return (
                    <td
                      key={role}
                      className={cn("px-2 py-1.5 text-center", role === highlight && "bg-accent-soft")}
                    >
                      <span className="sr-only">
                        {ROLE_LABELS[role]} {held ? "holds" : "does not hold"} {permission.label}
                      </span>
                      {held ? (
                        <Check className="mx-auto size-3.5 text-success" aria-hidden />
                      ) : (
                        <Minus className="mx-auto size-3.5 text-faint-foreground/50" aria-hidden />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
