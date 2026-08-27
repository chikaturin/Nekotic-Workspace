"use client";

import { RotateCcw, Users } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import type { ListboxOption } from "@/components/ui/listbox";
import { Select } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCESS_SOURCE_LABELS, ROLE_LABELS, ROLE_SUMMARIES, subjectKey } from "@/lib/permissions";
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

/**
 * One tone ramp, read as a sentence: access that merely arrived is chrome,
 * access written here is a fact about this item, and access written here that
 * *replaced* something is the one worth spotting from across the row.
 *
 * `neutral` and `info` are the ramp's own names for the tones these badges
 * have always worn, so the row looks exactly as it did — only now the names
 * mean something next to the other five.
 */
const SOURCE_VARIANT: Readonly<Record<AccessSource, BadgeVariant>> = {
  workspace: "neutral",
  inherited: "neutral",
  explicit: "success",
  override: "info",
};

/**
 * The roles, each carrying what it actually permits. That sentence is the
 * reason this is a popover list rather than a native select: "Manager" on its
 * own does not tell you that granting it also hands over the structure.
 */
const ROLE_OPTIONS: readonly ListboxOption[] = WORKSPACE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
  description: ROLE_SUMMARIES[role],
}));

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
        const name = subjectName(entry.subject);

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

            {/* Only a rule written here can be taken away; there is nothing to
                reset on access that is merely flowing through.

                The tooltip stays wrapped by hand rather than moving to
                `IconButton`'s own `tooltip` prop, because the moment it is most
                needed is the moment the button is disabled — and a disabled
                button fires no pointer events for a trigger to hear. The span
                is the element that keeps hearing them. */}
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
