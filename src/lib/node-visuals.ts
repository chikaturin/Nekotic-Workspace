import {
  ChartGantt,
  File as FileIcon,
  FileArchive,
  FileCode,
  FileMusic,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  SlidersHorizontal,
  SquareKanban,
  Table2,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { BoardKind, DriveNode, FileKind } from "@/types";

export interface NodeVisual {
  readonly Icon: LucideIcon;
  readonly colorClass: string;
  readonly tintClass: string;
  readonly label: string;
}

const FILE_ICONS: Record<FileKind, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  pdf: FileText,
  video: Video,
  audio: FileMusic,
  archive: FileArchive,
  code: FileCode,
  other: FileIcon,
};

const FILE_LABELS: Record<FileKind, string> = {
  image: "Image",
  document: "Document",
  spreadsheet: "Spreadsheet",
  pdf: "PDF",
  video: "Video",
  audio: "Audio",
  archive: "Archive",
  code: "Source",
  other: "File",
};

const BOARD_ICONS: Record<BoardKind, LucideIcon> = {
  kanban: SquareKanban,
  table: Table2,
  timeline: ChartGantt,
  doc: FileText,
};

const BOARD_LABELS: Record<BoardKind, string> = {
  kanban: "Kanban board",
  table: "Table view",
  timeline: "Timeline",
  doc: "Doc",
};

const FILE_COLOR_CLASSES: Record<FileKind, string> = {
  image: "text-kind-image",
  document: "text-kind-document",
  spreadsheet: "text-kind-spreadsheet",
  pdf: "text-kind-pdf",
  video: "text-kind-video",
  audio: "text-kind-audio",
  archive: "text-kind-archive",
  code: "text-kind-code",
  other: "text-kind-other",
};

const FILE_TINT_CLASSES: Record<FileKind, string> = {
  image: "bg-kind-image/10",
  document: "bg-kind-document/10",
  spreadsheet: "bg-kind-spreadsheet/10",
  pdf: "bg-kind-pdf/10",
  video: "bg-kind-video/10",
  audio: "bg-kind-audio/10",
  archive: "bg-kind-archive/10",
  code: "bg-kind-code/10",
  other: "bg-kind-other/10",
};

export function fileKindVisual(kind: FileKind): NodeVisual {
  return {
    Icon: FILE_ICONS[kind],
    colorClass: FILE_COLOR_CLASSES[kind],
    tintClass: FILE_TINT_CLASSES[kind],
    label: FILE_LABELS[kind],
  };
}

export function nodeVisual(node: DriveNode, isOpen = false): NodeVisual {
  switch (node.type) {
    case "project":
      return {
        Icon: isOpen ? FolderOpen : Folder,
        colorClass: "text-accent",
        tintClass: "bg-accent/12",
        label: "Project",
      };
    case "folder":
      return {
        Icon: isOpen ? FolderOpen : Folder,
        colorClass: "text-kind-folder",
        tintClass: "bg-kind-folder/12",
        label: "Folder",
      };
    case "document": {
      const kind = node.documentKind ?? "page";

      if (kind === "config") {
        return {
          Icon: SlidersHorizontal,
          colorClass: "text-kind-code",
          tintClass: "bg-kind-code/12",
          label: "Config",
        };
      }
      if (kind === "secret") {
        return {
          Icon: KeyRound,
          colorClass: "text-kind-pdf",
          tintClass: "bg-kind-pdf/12",
          label: "Secret",
        };
      }

      return {
        Icon: FileText,
        colorClass: "text-kind-document",
        tintClass: "bg-kind-document/12",
        label: "Page",
      };
    }
    case "board":
      return {
        Icon: BOARD_ICONS[node.boardKind],
        colorClass: "text-kind-board",
        tintClass: "bg-kind-board/12",
        label: BOARD_LABELS[node.boardKind],
      };
    case "file":
      return fileKindVisual(node.kind);
  }
}

const EXTENSION_KINDS: Record<string, FileKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  avif: "image",
  pdf: "pdf",
  doc: "document",
  docx: "document",
  txt: "document",
  md: "document",
  rtf: "document",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  csv: "spreadsheet",
  mp4: "video",
  mov: "video",
  webm: "video",
  mp3: "audio",
  wav: "audio",
  zip: "archive",
  rar: "archive",
  gz: "archive",
  ts: "code",
  tsx: "code",
  js: "code",
  jsx: "code",
  json: "code",
  sql: "code",
  go: "code",
  py: "code",
  sh: "code",
  bash: "code",
  yml: "code",
  yaml: "code",
  tf: "code",
  xml: "code",
  html: "code",
  css: "code",
};

export function kindFromFileName(fileName: string): FileKind {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_KINDS[extension] ?? "other";
}

export function extensionOf(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
}

export function isPreviewable(node: DriveNode): boolean {
  return node.type === "file" && ["image", "document", "code", "pdf"].includes(node.kind);
}
