"use client";

import { Archive, ArchiveRestore, Lock, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NodeAccessDialog } from "@/components/permissions/node-access-dialog";
import { PermissionDialog } from "@/components/permissions/permission-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FavoriteStar } from "@/components/shared/favorite-star";
import { Button } from "@/components/ui/button";
import { useOpenNode } from "@/hooks/use-open-node";
import { usePermissions } from "@/hooks/use-permissions";
import { isArchivedNode } from "@/lib/archive";
import { hrefForNode } from "@/lib/tree";
import { getActiveTree, useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode } from "@/types";

interface BoardSettingsActionsProps {
  readonly node: DriveNode;
  readonly href: string;
  readonly onDone: () => void;
}

/**
 * Những hành động vốn chỉ nằm trong menu "…" của item trên cây drive.
 *
 * Cùng store action, cùng hộp thoại, cùng khoá quyền như `DriveItemMenu` — đây
 * là lối vào thứ hai chứ không phải bản sao. Chép logic ra đây sẽ đẻ ra hai chỗ
 * quyết định "ai được xoá board", và chúng sẽ lệch nhau.
 *
 * Khác một điểm có chủ đích: menu kia bấm từ DANH SÁCH, còn ở đây người dùng
 * đang đứng ngay trong board. Nên lưu trữ hay xoá xong phải đưa họ đi chỗ khác,
 * không thì họ ở lại một trang vừa biến mất.
 */
export function BoardSettingsActions({ node, href, onDone }: BoardSettingsActionsProps) {
  const router = useRouter();
  const openNode = useOpenNode();
  const can = usePermissions(node);

  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);
  const trashNode = useWorkspaceStore((state) => state.trashNode);
  const setNodeArchived = useWorkspaceStore((state) => state.setNodeArchived);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);

  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isConfirmingTrash, setIsConfirmingTrash] = useState(false);

  const isArchived = isArchivedNode(node);

  async function copyShareLink() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      pushFeedback(`Share link copied for “${node.name}”`, "success");
    } catch {
      pushFeedback("Could not reach the clipboard — copy the address bar instead", "error");
    }
  }

  function archive() {
    setNodeArchived(node.id, !isArchived);
    onDone();
    if (!isArchived) router.push("/archive");
  }

  function trash() {
    const parentHref = node.parentId ? hrefForNode(getActiveTree(), node.parentId) : "/drive";

    setIsConfirmingTrash(false);
    trashNode(node.id);
    onDone();
    openNode(parentHref);
  }

  return (
    <>
      <div className="space-y-4">
        <section className="space-y-2">
          <h3 className="text-body font-medium uppercase tracking-wide text-faint-foreground">
            This board
          </h3>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleFavorite(node.id)}>
              <FavoriteStar isFavorite={node.isFavorite} />
              {node.isFavorite ? "Remove from favorites" : "Add to favorites"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!can("node.share")}
              onClick={() => void copyShareLink()}
            >
              <Share2 />
              Copy share link
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-body font-medium uppercase tracking-wide text-faint-foreground">
            Who can see it
          </h3>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!can("node.access.manage")}
              onClick={() => setIsAccessOpen(true)}
            >
              <Lock />
              Manage access
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!can("workspace.permission.manage")}
              onClick={() => setIsRolesOpen(true)}
            >
              <ShieldCheck />
              Roles on this item
            </Button>
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-body font-medium uppercase tracking-wide text-faint-foreground">
            Danger zone
          </h3>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!can("node.archive")}
              onClick={archive}
            >
              {isArchived ? <ArchiveRestore /> : <Archive />}
              {isArchived ? "Restore from archive" : "Archive"}
            </Button>

            <Button
              size="sm"
              variant="danger"
              disabled={!can("node.delete")}
              onClick={() => setIsConfirmingTrash(true)}
            >
              <Trash2 />
              Move to Trash
            </Button>
          </div>

          <p className="text-body text-faint-foreground">
            Archiving freezes the board and everything in it. Trash keeps it recoverable.
          </p>
        </section>
      </div>

      <NodeAccessDialog node={node} isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />

      <PermissionDialog node={node} isOpen={isRolesOpen} onClose={() => setIsRolesOpen(false)} />

      <ConfirmDialog
        isOpen={isConfirmingTrash}
        title={`Move “${node.name}” to Trash?`}
        description="The board and every record in it leave the workspace. You can restore it from Trash."
        confirmLabel="Move to Trash"
        isDestructive
        onClose={() => setIsConfirmingTrash(false)}
        onConfirm={trash}
      />
    </>
  );
}
