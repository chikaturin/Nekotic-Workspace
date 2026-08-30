"use client";

import { FileManager } from "@/components/files/file-manager";
import { NotFoundState } from "@/components/drive/empty-state";
import { useRouteSegments } from "@/hooks/use-route-segments";
import { useDriveLocation } from "@/hooks/use-drive-location";
import { formatCount } from "@/lib/format";
import { pathLabel, visibleFilesOf } from "@/lib/tree";
import { selectActiveWorkspace, selectTree, useWorkspaceStore } from "@/store/workspace-store";
import { isContainer } from "@/types";

interface FilesViewProps {
  readonly segments: readonly string[];
}

export function FilesView({ segments: prerendered }: FilesViewProps) {
  const segments = useRouteSegments(prerendered);
  const location = useDriveLocation(segments);
  const workspace = useWorkspaceStore(selectActiveWorkspace);
  const tree = useWorkspaceStore(selectTree);

  if (location.isNotFound) {
    const matched = location.ancestors.length + (location.node ? 1 : 0);
    return <NotFoundState segment={segments[matched] ?? segments[segments.length - 1] ?? ""} />;
  }

  const node = location.node;
  if (node && !isContainer(node)) {
    return <NotFoundState segment={node.name} />;
  }

  const fileCount = visibleFilesOf(tree, node).length;

  return (
    <FileManager
      folderId={node?.id ?? null}
      title={node ? node.name : workspace.name}
      description={
        node
          ? `${pathLabel(tree, node.id)} · ${formatCount(fileCount, "file")}`
          : `Workspace root · ${formatCount(fileCount, "file")}`
      }
    />
  );
}
