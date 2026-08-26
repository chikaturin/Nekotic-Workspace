import { fileMetadataEntries } from "@/lib/file-metadata";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types";

interface FileMetadataTableProps {
  readonly node: FileNode;
  readonly className?: string;
}

/** name · type · size · owner · createdAt — the contract for every file. */
export function FileMetadataTable({ node, className }: FileMetadataTableProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-px overflow-hidden rounded-lg border border-border bg-hairline",
        className,
      )}
    >
      {fileMetadataEntries(node).map((entry) => (
        <div key={entry.label} className="contents">
          <dt className="bg-surface px-3 py-2 text-[11px] font-medium text-faint-foreground">
            {entry.label}
          </dt>
          <dd className="metric truncate bg-surface px-3 py-2 text-[12px] text-foreground">
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
