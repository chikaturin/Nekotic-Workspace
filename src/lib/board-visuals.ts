import {
  AlignLeft,
  CalendarDays,
  CalendarRange,
  CircleUser,
  GanttChartSquare,
  Link2,
  ListChecks,
  Paperclip,
  SquareKanban,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { BoardViewType, ColumnType } from "@/types";

const COLUMN_ICONS: Readonly<Record<ColumnType, LucideIcon>> = {
  text: Type,
  longText: AlignLeft,
  select: ListChecks,
  date: CalendarDays,
  user: CircleUser,
  attachment: Paperclip,
  relation: Link2,
};

export interface ColumnVisual {
  readonly Icon: LucideIcon;
}

/** Returns the icon as a property, not as a bare return value — a component
 * handed straight back from a call reads as "created during render". */
export function columnVisual(type: ColumnType): ColumnVisual {
  return { Icon: COLUMN_ICONS[type] };
}

export const VIEW_TYPE_LABELS: Readonly<Record<BoardViewType, string>> = {
  table: "Table",
  kanban: "Kanban",
  calendar: "Calendar",
  gantt: "Gantt",
};

const VIEW_ICONS: Readonly<Record<BoardViewType, LucideIcon>> = {
  table: Table2,
  kanban: SquareKanban,
  calendar: CalendarRange,
  gantt: GanttChartSquare,
};

export function viewVisual(type: BoardViewType): ColumnVisual {
  return { Icon: VIEW_ICONS[type] };
}
