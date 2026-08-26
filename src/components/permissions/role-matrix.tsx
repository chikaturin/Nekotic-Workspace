"use client";

import { Check, Minus } from "lucide-react";
import { ROLE_LABELS, ROLE_SUMMARIES, permissionsByModule, roleHas } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { WORKSPACE_ROLES, type WorkspaceRole } from "@/types";

/**
 * The role matrix (SY-RBC-42), rendered from the same catalogue the app runs
 * on. It is not a picture of the rules — it *is* the rules, read out. A key
 * that never reaches this table is a key no component could be gating on.
 */
export function RoleMatrix({ highlight }: { highlight?: WorkspaceRole | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-elevated">
          <tr className="border-b border-border">
            <th scope="col" className="w-1/2 px-2 py-2 text-left font-medium text-muted-foreground">
              Permission
            </th>
            {WORKSPACE_ROLES.map((role) => (
              <th
                key={role}
                scope="col"
                title={ROLE_SUMMARIES[role]}
                className={cn(
                  "px-2 py-2 text-center font-medium",
                  role === highlight ? "text-accent" : "text-muted-foreground",
                )}
              >
                {ROLE_LABELS[role]}
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
                className="bg-surface px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-faint-foreground"
              >
                {group.label}
              </th>
            </tr>

            {group.permissions.map((permission) => (
              <tr key={permission.key} className="border-b border-hairline last:border-0">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  <span className="text-foreground">{permission.label}</span>
                  <span className="metric ml-1.5 text-[10px] text-faint-foreground">
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
