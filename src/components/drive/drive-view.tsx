"use client";

import { FolderOpen } from "lucide-react";
import { useEffect, useMemo, type MouseEvent } from "react";
import { DriveCanvas } from "@/components/drive/drive-canvas";
import { DriveGrid } from "@/components/drive/drive-grid";
import { DriveList } from "@/components/drive/drive-list";
import { DriveToolbar } from "@/components/drive/drive-toolbar";
import { EmptyState, NotFoundState } from "@/components/drive/empty-state";
import { NodeDetail } from "@/components/drive/node-detail";
import { BoardPage } from "@/components/board/board-page";
import { ConfigDocumentPage } from "@/components/devtools/config-document-page";
import { SecretDocumentPage } from "@/components/devtools/secret-document-page";
import { DocumentPage } from "@/components/document/document-page";
import { PermissionDeniedState } from "@/components/shared/state-panels";
import { DRIVE_ROOT_PATH, FILES_ROOT_PATH } from "@/config/app";
import { useCapabilities } from "@/hooks/use-permissions";
import { useTrackRecent } from "@/hooks/use-recent";
import { deniedReason } from "@/lib/permissions";
import { nodeRef } from "@/lib/entity-ref";
import { useDriveLocation } from "@/hooks/use-drive-location";
import { useRouteSegments } from "@/hooks/use-route-segments";
import { formatCount } from "@/lib/format";
import { pathLabel } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { documentKindOf, isBoard, isContainer, isDocument } from "@/types";
import { routableHref } from "@/lib/exported-routes";

interface DriveViewProps {
  /** URL path segments below `/drive`, already decoded — what was prerendered. */
  readonly segments: readonly string[];
}

/** Drive Mode: folder contents as grid or list, with drop targets everywhere. */
export function DriveView({ segments: prerendered }: DriveViewProps) {
  // The live URL wins over the params the page was built with, so this one
  // prerendered route can also serve `/drive/?p=…` — the address a node made
  // after the build has to use.
  const segments = useRouteSegments(prerendered);
  const location = useDriveLocation(segments);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);

  const viewMode = useWorkspaceStore((state) => state.viewMode);
  const selectedIds = useWorkspaceStore((state) => state.selectedIds);
  const toggleSelection = useWorkspaceStore((state) => state.toggleSelection);
  const clearSelection = useWorkspaceStore((state) => state.clearSelection);
  const expandToNode = useWorkspaceStore((state) => state.expandToNode);
  const createFolder = useWorkspaceStore((state) => state.createFolder);

  const { node, visibleChildren, isNotFound, isDenied } = location;
  const capabilities = useCapabilities(node);

  /**
   * Only containers are recorded here. Documents, boards and files record
   * themselves, because reaching this component is not the same as opening
   * them — a page renders its own surface below.
   */
  const recentTarget = useMemo(
    () => (node && isContainer(node) && capabilities.view ? nodeRef(node) : null),
    [node, capabilities.view],
  );
  useTrackRecent(recentTarget);

  /** Keep the sidebar tree opened to whatever the URL points at. */
  useEffect(() => {
    if (node) expandToNode(node.id);
  }, [node, expandToNode]);

  useEffect(() => {
    clearSelection();
  }, [segments, clearSelection]);

  const basePath = useMemo(
    () =>
      segments.length === 0
        ? DRIVE_ROOT_PATH
        : `${DRIVE_ROOT_PATH}/${segments.map(encodeURIComponent).join("/")}`,
    [segments],
  );

  /**
   * Refused before "not found", and refused *without naming anything*. The
   * page never loaded the node's metadata, its children or its content — the
   * tree it resolved against does not contain them.
   */
  if (isDenied) {
    return (
      <PermissionDeniedState
        error={{
          code: "permission_denied",
          message: "You don't have access to this item",
          detail: deniedReason(),
          isRetryable: false,
        }}
      />
    );
  }

  if (isNotFound) {
    const matched = location.ancestors.length + (node ? 1 : 0);
    return <NotFoundState segment={segments[matched] ?? segments[segments.length - 1] ?? ""} />;
  }

  if (node && !capabilities.view) {
    return (
      <PermissionDeniedState
        error={{
          code: "permission_denied",
          message: `“${node.name}” is not available to you`,
          detail: deniedReason(),
          isRetryable: false,
        }}
      />
    );
  }

  if (node && isDocument(node)) {
    const kind = documentKindOf(node);
    if (kind === "config") return <ConfigDocumentPage node={node} />;
    if (kind === "secret") return <SecretDocumentPage node={node} />;
    return <DocumentPage node={node} />;
  }
  if (node && isBoard(node)) return <BoardPage node={node} />;

  const title = node?.name ?? workspace.name;
  const isLeaf = node !== null && !isContainer(node);
  const subtitle = node
    ? `${pathLabel(tree, node.id)} · ${formatCount(visibleChildren.length, "item")}`
    : `Workspace root · ${formatCount(visibleChildren.length, "item")}`;

  function handleBackgroundClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) clearSelection();
  }

  return (
    <div className="flex h-full flex-col">
      <DriveToolbar
        title={title}
        subtitle={subtitle}
        targetId={location.dropTargetId}
        filesHref={routableHref(`${FILES_ROOT_PATH}${basePath.slice(DRIVE_ROOT_PATH.length)}`)}
      />

      <div
        onClick={handleBackgroundClick}
        className="canvas-grid min-h-0 flex-1 overflow-y-auto bg-canvas p-3"
      >
        {isLeaf && node ? (
          <NodeDetail node={node} />
        ) : (
          <DriveCanvas targetId={location.dropTargetId} targetName={title}>
            {visibleChildren.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title={`${title} is empty`}
                description="Drag files here to upload, or create a folder to start organising this space."
                action={{
                  label: "New folder",
                  onClick: () => createFolder(location.dropTargetId, "Untitled folder"),
                }}
              />
            ) : viewMode === "grid" ? (
              <DriveGrid
                nodes={visibleChildren}
                resolveHref={(child) => `${basePath}/${child.slug}`}
                selectedIds={selectedIds}
                onSelect={toggleSelection}
                revealKey={basePath}
              />
            ) : (
              <DriveList
                nodes={visibleChildren}
                resolveHref={(child) => `${basePath}/${child.slug}`}
                selectedIds={selectedIds}
                onSelect={toggleSelection}
                revealKey={basePath}
              />
            )}
          </DriveCanvas>
        )}
      </div>
    </div>
  );
}
