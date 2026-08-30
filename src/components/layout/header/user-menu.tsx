"use client";

import { LogOut, Moon, Settings, Sun, Users } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceSettingsDialog } from "@/components/workspace/workspace-settings-dialog";
import { useTheme } from "@/hooks/use-theme";
import { ANONYMOUS_USER, useCurrentUser, useSessionStore } from "@/store/session-store";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspace-store";

export function UserMenu() {
  const { theme, toggleTheme } = useTheme();
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const user = useCurrentUser() ?? ANONYMOUS_USER;
  const signOut = useSessionStore((state) => state.signOut);
  const [settingsTab, setSettingsTab] = useState<"members" | "general" | null>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Account menu"
      >
        <UserAvatar user={user} className="size-8" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <UserAvatar user={user} className="size-8" />
          <div className="min-w-0">
            <p className="truncate text-lead font-medium text-foreground">{user.name}</p>
            <p className="truncate text-body text-faint-foreground">{user.email}</p>
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{workspace.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setSettingsTab("members")}>
          <Users />
          Members
          <DropdownMenuShortcut>{workspace.members.length}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSettingsTab("general")}>
          <Settings />
          Workspace settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); toggleTheme(); }}>
          {theme === "dark" ? <Sun /> : <Moon />}
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>

      <WorkspaceSettingsDialog
        key={settingsTab ?? "closed"}
        isOpen={settingsTab !== null}
        initialTab={settingsTab ?? "general"}
        onClose={() => setSettingsTab(null)}
      />
    </DropdownMenu>
  );
}
