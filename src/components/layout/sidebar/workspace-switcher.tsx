"use client";

import { Check, ChevronsUpDown, Eye, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { WorkspaceSettingsDialog } from "@/components/workspace/workspace-settings-dialog";
import { DRIVE_ROOT_PATH } from "@/config/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffectiveRole, usePermissions } from "@/hooks/use-permissions";
import { useMyWorkspaces } from "@/hooks/use-workspace-access";
import { ROLE_LABELS } from "@/lib/permissions";
import { selectPreviewRole, usePermissionStore } from "@/store/permission-store";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import { WORKSPACE_ROLES, type Workspace } from "@/types";

function WorkspaceTile({ workspace, className }: { workspace: Workspace; className?: string }) {
  return (
    <span
      className={cn(
        "metric flex size-7 shrink-0 items-center justify-center rounded-md text-body font-bold",
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklch, ${workspace.color} 22%, transparent)`, color: workspace.color }}
    >
      {workspace.badge}
    </span>
  );
}

interface WorkspaceSwitcherProps {
  readonly isCollapsed: boolean;
}

/**
 * Tenant switcher: swapping workspaces swaps the whole drive tree.
 *
 * It lists the workspaces this person is a member of, and no others — read
 * from `useMyWorkspaces` rather than filtered here, so a workspace they are not
 * in is absent from the data the component holds rather than hidden by it.
 */
export function WorkspaceSwitcher({ isCollapsed }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const workspaces = useMyWorkspaces();
  const can = usePermissions();
  const role = useEffectiveRole();
  const [isCreating, setIsCreating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const previewRole = usePermissionStore(selectPreviewRole);
  const setPreviewRole = usePermissionStore((state) => state.setPreviewRole);
  const active = useWorkspaceStore(selectActiveWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  function handleSelect(workspaceId: string) {
    // The store refuses a workspace this person is not in. It cannot happen
    // from this menu — it can from a restored session or a stale link.
    if (setActiveWorkspace(workspaceId)) router.push(DRIVE_ROOT_PATH);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition-colors",
          "hover:border-border hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring outline-none",
          isCollapsed && "justify-center",
        )}
        aria-label="Switch workspace"
      >
        <WorkspaceTile workspace={active} />
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lead font-semibold text-foreground">{active.name}</span>
              <span className="metric block text-micro uppercase tracking-wider text-faint-foreground">
                {active.plan} plan
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-faint-foreground transition-colors group-hover:text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onSelect={() => handleSelect(workspace.id)}
            className="gap-2.5 py-2"
          >
            <WorkspaceTile workspace={workspace} className="size-6 text-micro" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lead">{workspace.name}</span>
              <span className="block truncate text-body text-faint-foreground">
                {workspace.members.length} members
              </span>
            </span>
            {workspace.id === active.id ? (
              <Check className="size-4 text-accent" />
            ) : (
              <Badge variant="default">{workspace.plan}</Badge>
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Reachable from every screen, because the whole point is to walk the
            app as somebody else. Previewing can only ever take affordances
            away — a member previewing as admin still sees a member's app. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Eye />
            Preview as
            <span className="ml-auto text-body text-faint-foreground">
              {ROLE_LABELS[previewRole ?? role]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem onSelect={() => setPreviewRole(null)}>
              My role ({ROLE_LABELS[role]})
              {previewRole === null && <Check className="ml-auto size-4 text-accent" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {WORKSPACE_ROLES.map((candidate) => (
              <DropdownMenuItem key={candidate} onSelect={() => setPreviewRole(candidate)}>
                {ROLE_LABELS[candidate]}
                {previewRole === candidate && <Check className="ml-auto size-4 text-accent" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => setIsCreating(true)}>
          <Plus />
          Create workspace
        </DropdownMenuItem>

        {/* Settings is offered only to somebody with a reason to open it. The
            dialog decides which tabs exist; this decides whether the door does. */}
        {can("workspace.settings.view") && (
          <DropdownMenuItem onSelect={() => setIsConfiguring(true)}>
            <Settings />
            Workspace settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>

      <CreateWorkspaceDialog isOpen={isCreating} onClose={() => setIsCreating(false)} />
      <WorkspaceSettingsDialog
        isOpen={isConfiguring}
        onClose={() => setIsConfiguring(false)}
      />
    </DropdownMenu>
  );
}
