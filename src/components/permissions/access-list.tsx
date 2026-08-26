"use client";

import { RotateCcw, Users } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCESS_SOURCE_LABELS, ROLE_LABELS, subjectKey } from "@/lib/permissions";
import { DIRECTORY } from "@/mock/users";
import { WORKSPACE_ROLES, type AccessSource, type AccessSubject, type ResolvedAccess, type WorkspaceRole } from "@/types";

/**
 * Who has access to one node, and why (SY-INH-43).
 *
 * Every row says where its access came from, because "Member" alone is not an
 * answer a person can act on: whether it arrived from the project above or was
 * written here decides what changing it will do.
 */

interface AccessListProps {
  readonly entries: readonly ResolvedAccess[];
  readonly canManage: boolean;
  readonly onGrant: (subject: AccessSubject, role: WorkspaceRole) => void;
  readonly onReset: (subject: AccessSubject) => void;
}

const SOURCE_VARIANT: Readonly<Record<AccessSource, "default" | "accent" | "success">> = {
  workspace: "default",
  inherited: "default",
  explicit: "success",
  override: "accent",
};

function subjectName(subject: AccessSubject): string {
  if (subject.kind === "role") return `Everyone · ${ROLE_LABELS[subject.role]}`;
  return DIRECTORY.find((person) => person.id === subject.userId)?.name ?? "Unknown member";
}

/** What the badge means, spelled out where the badge is too short to say it. */
function sourceHint(entry: ResolvedAccess): string {
  switch (entry.source) {
    case "workspace":
      return "Comes from their workspace role. Nothing is written on this item.";
    case "inherited":
      return `Flows down from ${entry.inheritedFrom?.name ?? "an item above"}.`;
    case "explicit":
      return "Written on this item. It happens to match what it would inherit.";
    case "override":
      return `Written on this item, replacing ${
        entry.inheritedRole ? ROLE_LABELS[entry.inheritedRole] : "no access"
      }${entry.inheritedFrom ? ` from ${entry.inheritedFrom.name}` : ""}.`;
  }
}

export function AccessList({ entries, canManage, onGrant, onReset }: AccessListProps) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const key = subjectKey(entry.subject);
        const subject = entry.subject;
        const person =
          subject.kind === "user"
            ? DIRECTORY.find((candidate) => candidate.id === subject.userId)
            : undefined;
        const isWritten = entry.source === "explicit" || entry.source === "override";

        return (
          <li
            key={key}
            className="flex items-center gap-2.5 border-b border-hairline px-1 py-2 last:border-0"
          >
            {person ? (
              <UserAvatar user={person} className="size-7" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface">
                <Users className="size-3.5 text-faint-foreground" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-foreground">{subjectName(entry.subject)}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Badge variant={SOURCE_VARIANT[entry.source]}>
                      {entry.source === "inherited" && entry.inheritedFrom
                        ? `Inherited · ${entry.inheritedFrom.name}`
                        : ACCESS_SOURCE_LABELS[entry.source]}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{sourceHint(entry)}</TooltipContent>
              </Tooltip>
            </div>

            <SelectField
              value={entry.role}
              aria-label={`Access for ${subjectName(entry.subject)}`}
              disabled={!canManage}
              onChange={(event) => onGrant(entry.subject, event.target.value as WorkspaceRole)}
            >
              {WORKSPACE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </SelectField>

            {/* Only a rule written here can be taken away; there is nothing to
                reset on access that is merely flowing through. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={!canManage || !isWritten}
                    aria-label={`Reset ${subjectName(entry.subject)} to inherited access`}
                    onClick={() => onReset(entry.subject)}
                  >
                    <RotateCcw />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isWritten ? "Reset to inherited" : "Nothing is written here to reset"}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
