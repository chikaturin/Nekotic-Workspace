"use client";

import { RotateCcw, Users } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCESS_SOURCE_LABELS, ROLE_LABELS, ROLE_SUMMARIES, subjectKey } from "@/lib/permissions";
import { useDirectory } from "@/hooks/use-directory";
import { WORKSPACE_ROLES, type AccessSource, type AccessSubject, type DirectoryUser, type ResolvedAccess, type WorkspaceRole } from "@/types";

interface AccessListProps {
  readonly entries: readonly ResolvedAccess[];
  readonly canManage: boolean;
  readonly onGrant: (subject: AccessSubject, role: WorkspaceRole) => void;
  readonly onReset: (subject: AccessSubject) => void;
}

const SOURCE_VARIANT: Readonly<Record<AccessSource, BadgeVariant>> = {
  workspace: "neutral",
  inherited: "neutral",
  explicit: "success",
  override: "info",
};

const ROLE_OPTIONS: readonly ListboxOption[] = WORKSPACE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_SUMMARIES[role],
}));

function subjectName(
  subject: AccessSubject,
  directory: readonly DirectoryUser[],
): string {
  if (subject.kind === "role") return `Everyone · ${ROLE_LABELS[subject.role]}`;
  return directory.find((person) => person.id === subject.userId)?.name ?? "Unknown member";
}

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
  const directory = useDirectory();

  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const key = subjectKey(entry.subject);
        const subject = entry.subject;
        const person =
          subject.kind === "user"
            ? directory.find((candidate) => candidate.id === subject.userId)
            : undefined;
        const isWritten = entry.source === "explicit" || entry.source === "override";
        const name = subjectName(entry.subject, directory);

        return (
          <li
            key={key}
            className="flex items-center gap-2.5 border-b border-hairline px-1 py-2 last:border-0"
          >
            {person ? (
              <UserAvatar user={person} size="lg" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface">
                <Users className="size-3.5 text-faint-foreground" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-lead text-foreground">{name}</p>
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

            <Select
              size="sm"
              value={entry.role}
              options={ROLE_OPTIONS}
              aria-label={`Access for ${name}`}
              isDisabled={!canManage}
              onValueChange={(next) => {
                if (next !== null) onGrant(entry.subject, next as WorkspaceRole);
              }}
              className="w-32 shrink-0"
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <IconButton
                    variant="ghost"
                    disabled={!canManage || !isWritten}
                    aria-label={`Reset ${name} to inherited access`}
                    onClick={() => onReset(entry.subject)}
                  >
                    <RotateCcw />
                  </IconButton>
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
