import { MOCK_NOW } from "@/config/app";
import { extensionOf, kindFromFileName } from "@/lib/node-visuals";
import { slugify, uniqueSlug } from "@/lib/utils";
import { memberAt } from "@/mock/users";
import { svgPreview } from "@/mock/preview";
import type {
  BoardKind,
  BoardNode,
  DocumentKind,
  DocumentNode,
  DriveNode,
  FileNode,
  FolderNode,
  ProjectNode,
  ProjectStatus,
} from "@/types";

/* --------------------------------------------------------------- authoring */

interface SpecBase {
  readonly name: string;
  /** Hours before `MOCK_NOW` the node was last touched. */
  readonly updatedHoursAgo?: number;
  readonly ownerIndex?: number;
  readonly favorite?: boolean;
  readonly shared?: boolean;
  readonly trashed?: boolean;
  /** Access limited to admins — drives the permission-denied screens. */
  readonly restricted?: boolean;
}

export interface ProjectSpec extends SpecBase {
  readonly kind: "project";
  readonly color: string;
  readonly status?: ProjectStatus;
  readonly description?: string;
  readonly children: readonly NodeSpec[];
}

export interface FolderSpec extends SpecBase {
  readonly kind: "folder";
  readonly children: readonly NodeSpec[];
}

export interface DocumentSpec extends SpecBase {
  readonly kind: "document";
  readonly documentKind?: DocumentKind;
  readonly icon: string;
  readonly blockCount: number;
  readonly excerpt: string;
  readonly pinned?: boolean;
  readonly locked?: boolean;
  readonly archived?: boolean;
}

export interface BoardSpec extends SpecBase {
  readonly kind: "board";
  readonly boardKind: BoardKind;
  readonly itemCount: number;
  readonly openCount: number;
  /** Template that supplies the board's schema. */
  readonly templateId?: string;
}

export interface FileSpec extends SpecBase {
  /** `name` carries the extension, e.g. `webhook-flow.png`. */
  readonly kind: "file";
  readonly sizeBytes: number;
  readonly excerpt?: string;
  readonly version?: number;
}

export type NodeSpec = ProjectSpec | FolderSpec | DocumentSpec | BoardSpec | FileSpec;

export const project = (spec: Omit<ProjectSpec, "kind">): ProjectSpec => ({ ...spec, kind: "project" });
export const folder = (spec: Omit<FolderSpec, "kind">): FolderSpec => ({ ...spec, kind: "folder" });
export const doc = (spec: Omit<DocumentSpec, "kind">): DocumentSpec => ({ ...spec, kind: "document" });
export const board = (spec: Omit<BoardSpec, "kind">): BoardSpec => ({ ...spec, kind: "board" });
export const file = (spec: Omit<FileSpec, "kind">): FileSpec => ({ ...spec, kind: "file" });

/* --------------------------------------------------------------- hydration */

const HOUR_MS = 3_600_000;

function timestamp(hoursAgo: number): string {
  return new Date(new Date(MOCK_NOW).getTime() - hoursAgo * HOUR_MS).toISOString();
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  zip: "application/zip",
  ts: "text/typescript",
  tsx: "text/typescript",
  sql: "application/sql",
  json: "application/json",
};

interface HydrateContext {
  readonly workspaceId: string;
  readonly parentId: string | null;
  readonly idPrefix: string;
}

/**
 * Turn a nested authoring spec into fully-linked `DriveNode`s: ids derived from
 * the path, slugs de-duplicated per level, `parentId` wired both ways.
 */
export function hydrate(specs: readonly NodeSpec[], context: HydrateContext): readonly DriveNode[] {
  const takenSlugs: string[] = [];

  return specs.map((spec, index) => {
    const slug = uniqueSlug(slugify(spec.name), takenSlugs);
    takenSlugs.push(slug);

    const id = `${context.idPrefix}_${slug}`.replace(/-/g, "_");
    const updatedAt = timestamp(spec.updatedHoursAgo ?? (index + 1) * 7);

    const base = {
      id,
      name: spec.name,
      slug,
      parentId: context.parentId,
      workspaceId: context.workspaceId,
      owner: memberAt(spec.ownerIndex ?? index),
      createdAt: timestamp((spec.updatedHoursAgo ?? (index + 1) * 7) + 720),
      updatedAt,
      isFavorite: spec.favorite ?? false,
      isTrashed: spec.trashed ?? false,
      isShared: spec.shared ?? false,
      ...(spec.restricted ? { accessMode: "restricted" as const } : {}),
    } as const;

    const childContext: HydrateContext = {
      workspaceId: context.workspaceId,
      parentId: id,
      idPrefix: id,
    };

    switch (spec.kind) {
      case "project": {
        const node: ProjectNode = {
          ...base,
          type: "project",
          color: spec.color,
          status: spec.status ?? "active",
          description: spec.description,
          children: hydrate(spec.children, childContext),
        };
        return node;
      }
      case "folder": {
        const node: FolderNode = {
          ...base,
          type: "folder",
          children: hydrate(spec.children, childContext),
        };
        return node;
      }
      case "document": {
        const node: DocumentNode = {
          ...base,
          type: "document",
          ...(spec.documentKind && spec.documentKind !== "page"
            ? { documentKind: spec.documentKind }
            : {}),
          icon: spec.icon,
          blockCount: spec.blockCount,
          excerpt: spec.excerpt,
          isPinned: spec.pinned ?? false,
          isLocked: spec.locked ?? false,
          isArchived: spec.archived ?? false,
        };
        return node;
      }
      case "board": {
        const node: BoardNode = {
          ...base,
          type: "board",
          boardKind: spec.boardKind,
          ...(spec.templateId ? { templateId: spec.templateId } : {}),
          itemCount: spec.itemCount,
          openCount: spec.openCount,
        };
        return node;
      }
      case "file": {
        const extension = extensionOf(spec.name);
        const fileKind = kindFromFileName(spec.name);
        const node: FileNode = {
          ...base,
          type: "file",
          kind: fileKind,
          extension,
          mimeType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
          sizeBytes: spec.sizeBytes,
          version: spec.version ?? 1,
          excerpt: spec.excerpt,
          previewUrl: fileKind === "image" ? svgPreview(id, spec.name) : undefined,
          thumbnailUrl: fileKind === "image" ? svgPreview(id, spec.name, 480, 320) : undefined,
        };
        return node;
      }
    }
  });
}
