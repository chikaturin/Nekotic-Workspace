"use client";

import { Archive, Download, Eye, LoaderCircle, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { WatchButton } from "@/components/collab/watch-button";
import { SimulationMenu } from "@/components/files/simulation-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { ViewConfigBar } from "@/components/board/config/view-config-bar";
import { ViewTabs } from "@/components/board/config/view-tabs";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { formatCount } from "@/lib/format";
import { useBoardStore } from "@/store/board-store";
import type { EntityRef, PermissionResolver } from "@/types";

interface BoardToolbarProps {
  readonly model: BoardViewModel;
  readonly onReload: () => void;
  /** Bound resolver — every affordance in the bar gates on its own key. */
  readonly can: PermissionResolver;
  readonly onImport: () => void;
  readonly onExport: () => void;
}

/** Saved views, search, column visibility, import/export and the write indicator. */
export function BoardToolbar({
  model,
  onReload,
  can,
  onImport,
  onExport,
}: BoardToolbarProps) {
  const { board, columns, rowIds, totalRows, archivedRows, isShowingArchived } = model;

  const setSearch = useBoardStore((state) => state.setSearch);
  const setShowArchived = useBoardStore((state) => state.setShowArchived);
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const addRow = useBoardStore((state) => state.addRow);
  const search = useBoardStore((state) => state.search);
  const pendingWrites = useBoardStore((state) => state.pendingWrites);

  const hiddenCount = columns.filter((column) => column.hidden).length;

  const boardTarget: EntityRef | null = board
    ? { kind: "board", nodeId: board.nodeId, label: board.name }
    : null;

  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-title font-semibold tracking-tight text-foreground">
            {board?.name}
            <Badge variant="default">{board?.rowIdPrefix}-000</Badge>
          </h1>
          <p className="metric truncate text-body text-faint-foreground">
            {rowIds.length === totalRows
              ? formatCount(totalRows, "record")
              : `${rowIds.length} of ${formatCount(totalRows, "record")}`}
            {pendingWrites > 0 && " · saving…"}
          </p>
        </div>

        {pendingWrites > 0 && <LoaderCircle className="size-3.5 animate-spin text-accent" />}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" />
          <Input
            value={search}
            placeholder="Search records…"
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search records"
            className="h-8 w-56 pl-7 text-ui"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Eye />
              Columns
              {hiddenCount > 0 && <Badge variant="count">{hiddenCount}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={!column.hidden}
                disabled={column.isPrimary}
                onCheckedChange={(checked) => void setColumnHidden(column.id, !checked)}
              >
                {column.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {archivedRows > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isShowingArchived ? "subtle" : "outline"}
                aria-pressed={isShowingArchived}
                className="gap-1.5"
                onClick={() => setShowArchived(!isShowingArchived)}
              >
                <Archive />
                <Badge variant="count">{archivedRows}</Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isShowingArchived ? "Hide archived records" : "Show archived records"}
            </TooltipContent>
          </Tooltip>
        )}

        <WatchButton target={boardTarget} />

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!can("board.import")}
          onClick={onImport}
        >
          <Upload />
          <span className="hidden lg:inline">Import</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!can("board.export")}
          onClick={onExport}
        >
          <Download />
          <span className="hidden lg:inline">Export</span>
        </Button>

        <Button size="icon" variant="outline" aria-label="Reload board" onClick={onReload}>
          <RotateCcw />
        </Button>

        <SimulationMenu />

        <Button
          size="sm"
          variant="default"
          className="gap-1.5"
          disabled={!can("row.create")}
          onClick={() => void addRow()}
        >
          <Plus />
          <span className="hidden sm:inline">New record</span>
        </Button>
      </div>

      <div className="pt-2">
        <ViewTabs model={model} can={can} />
        <ViewConfigBar model={model} />
      </div>
    </div>
  );
}
