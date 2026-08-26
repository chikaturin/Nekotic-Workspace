"use client";

import { Eye, LoaderCircle, Plus, RotateCcw, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ViewConfigBar } from "@/components/board/config/view-config-bar";
import { ViewTabs } from "@/components/board/config/view-tabs";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { formatCount } from "@/lib/format";
import { useBoardStore } from "@/store/board-store";

interface BoardToolbarProps {
  readonly model: BoardViewModel;
  readonly onReload: () => void;
}

/** Saved views, search, column visibility and the write indicator. */
export function BoardToolbar({ model, onReload }: BoardToolbarProps) {
  const { board, columns, rowIds, totalRows } = model;

  const setSearch = useBoardStore((state) => state.setSearch);
  const setColumnHidden = useBoardStore((state) => state.setColumnHidden);
  const addRow = useBoardStore((state) => state.addRow);
  const search = useBoardStore((state) => state.search);
  const pendingWrites = useBoardStore((state) => state.pendingWrites);

  const hiddenCount = columns.filter((column) => column.hidden).length;

  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-base font-semibold tracking-tight text-foreground">
            {board?.name}
            <Badge variant="default">{board?.rowIdPrefix}-000</Badge>
          </h1>
          <p className="metric truncate text-[11px] text-faint-foreground">
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
            className="h-8 w-56 pl-7 text-[12px]"
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

        <Button size="icon" variant="outline" aria-label="Reload board" onClick={onReload}>
          <RotateCcw />
        </Button>

        <SimulationMenu />

        <Button size="sm" variant="default" className="gap-1.5" onClick={() => void addRow()}>
          <Plus />
          <span className="hidden sm:inline">New record</span>
        </Button>
      </div>

      <div className="pt-2">
        <ViewTabs model={model} />
        <ViewConfigBar model={model} />
      </div>
    </div>
  );
}
