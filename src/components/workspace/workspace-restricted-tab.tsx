"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { FolderAccessDialog } from "@/components/permissions/folder-access-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestrictedNodes } from "@/hooks/use-workspace-access";
import { grantedSubjectsOn } from "@/lib/permissions/visibility";
import { pathLabel } from "@/lib/tree";
import { selectRulesFor, usePermissionStore } from "@/store/permission-store";
import { selectActiveWorkspace, selectFullTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode } from "@/types";

/**
 * Restricted folders, listed for whoever administers the workspace.
 *
 * This is the one surface that deliberately looks past resource access, and it
 * exists so a folder can never be locked beyond recovery. The trade is stated
 * plainly rather than hidden: an admin sees that a restricted folder exists,
 * what it is called and where it sits — and nothing inside it. They still do
 * not appear in its access list, they are still not counted as a member of it,
 * and the tree, search, favourites and every other surface still hide it from
 * them until somebody grants it.
 *
 * The alternative — an admin who is implicitly inside every restricted folder —
 * makes "restricted" mean "restricted unless you outrank it", which is not a
 * promise anybody can rely on. The alternative in the other direction is a
 * folder whose last member leaves and which nobody can ever reopen.
 *
 * Granting from here is an ordinary, audited rule write.
 */
export function WorkspaceRestrictedTab() {
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectFullTree);
  const rules = usePermissionStore(selectRulesFor(workspace.id));
  const restricted = useRestrictedNodes();

  const [managing, setManaging] = useState<DriveNode | null>(null);

  const rows = useMemo(
    () =>
      restricted.map((node) => ({
        node,
        path: pathLabel(tree, node.id),
        granted: grantedSubjectsOn(rules, node.id).length,
      })),
    [restricted, tree, rules],
  );

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-body text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-faint-foreground" />
        <span>
          Restricted folders are hidden from everybody they are not shared with — you
          included. This list shows that they exist so none of them can be locked beyond
          recovery. It shows no content, and granting yourself access is recorded in the
          audit log.
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="text-ui text-muted-foreground">
          No folder in {workspace.name} is restricted. Every folder inherits from the one
          above it.
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-md border border-border">
          {rows.map((row) => (
            <li key={row.node.id} className="flex items-center gap-2 px-3 py-2">
              <Lock className="size-3.5 shrink-0 text-faint-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui text-foreground">
                  {row.node.name}
                </span>
                <span className="block truncate text-body text-faint-foreground">
                  {row.path}
                </span>
              </span>
              <Badge variant="default">
                {row.granted} {row.granted === 1 ? "person" : "people"}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => setManaging(row.node)}>
                Manage access
              </Button>
            </li>
          ))}
        </ul>
      )}

      <FolderAccessDialog
        node={managing}
        isOpen={managing !== null}
        onClose={() => setManaging(null)}
      />
    </div>
  );
}
