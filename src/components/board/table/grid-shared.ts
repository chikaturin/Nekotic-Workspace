import type { CellContext } from "@/lib/cell-values";
import type { GridBounds } from "@/lib/grid-selection";
import type {
  BoardColumn,
  CellDisplayMode,
  CellValue,
  DirectoryUser,
  PermissionResolver,
  SelectOption,
} from "@/types";

export interface GridShared {
  readonly boardId: string;
  readonly primaryColumnId: string;
  readonly folderId: string | null;
  readonly people: readonly DirectoryUser[];
  readonly context: CellContext;
  readonly columns: readonly BoardColumn[];
  /** Khung của lưới — ô cần nó để không đưa con trỏ ra ngoài bảng khi rời ô. */
  readonly bounds: GridBounds;
  readonly rowHeight: number;
  readonly displayModes: Readonly<Record<string, CellDisplayMode>>;
  readonly warnedRowIds: ReadonlySet<string>;
  readonly can: PermissionResolver;
  readonly isReadOnly: boolean;
  readonly onToggleRow: (rowId: string, isRange: boolean) => void;
  readonly onCreateOption: (columnId: string, label: string) => Promise<SelectOption | null>;
  readonly onCommitCell: (rowId: string, columnId: string, value: CellValue) => void;
  readonly onFillPointerDown: ((event: React.PointerEvent) => void) | null;
}

export function widthVar(columnId: string): string {
  return `--col-w-${columnId}`;
}

export const GUTTER_WIDTH = 76;

export function widthStyle(columnId: string, isPrimary = false): React.CSSProperties {
  return isPrimary
    ? { width: `var(${widthVar(columnId)})`, left: GUTTER_WIDTH }
    : { width: `var(${widthVar(columnId)})` };
}
