"use client";

import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { DRIVE_ROOT_PATH } from "@/config/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";
import type { Workspace } from "@/types";

function WorkspaceTile({ workspace, className }: { workspace: Workspace; className?: string }) {
  return (
    <span
      className={cn(
        "metric flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
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

/** Tenant switcher: swapping workspaces swaps the whole drive tree. */
export function WorkspaceSwitcher({ isCollapsed }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const active = useWorkspaceStore(selectActiveWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  function handleSelect(workspaceId: string) {
    setActiveWorkspace(workspaceId);
    router.push(DRIVE_ROOT_PATH);
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
              <span className="block truncate text-sm font-semibold text-foreground">{active.name}</span>
              <span className="metric block text-[10px] uppercase tracking-wider text-faint-foreground">
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
            <WorkspaceTile workspace={workspace} className="size-6 text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{workspace.name}</span>
              <span className="block truncate text-[11px] text-faint-foreground">
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
        <DropdownMenuItem>
          <Plus />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
