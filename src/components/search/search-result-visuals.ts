import {
  Bug,
  ClipboardCheck,
  File,
  FileText,
  Folder,
  MessageSquare,
  Route,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { SearchResultKind } from "@/types";

/**
 * Icon and tint per result kind. Returned as an object rather than a bare
 * component so callers reach it through member access — creating a component
 * during render is what the static-components rule forbids.
 */
export interface ResultVisual {
  readonly Icon: LucideIcon;
  readonly colorClass: string;
}

const VISUALS: Readonly<Record<SearchResultKind, ResultVisual>> = {
  document: { Icon: FileText, colorClass: "text-kind-document" },
  api: { Icon: Route, colorClass: "text-kind-code" },
  bug: { Icon: Bug, colorClass: "text-kind-pdf" },
  qa: { Icon: ClipboardCheck, colorClass: "text-kind-spreadsheet" },
  row: { Icon: Table2, colorClass: "text-kind-board" },
  file: { Icon: File, colorClass: "text-kind-other" },
  comment: { Icon: MessageSquare, colorClass: "text-kind-audio" },
  place: { Icon: Folder, colorClass: "text-kind-folder" },
};

export function resultVisual(kind: SearchResultKind): ResultVisual {
  return VISUALS[kind];
}
