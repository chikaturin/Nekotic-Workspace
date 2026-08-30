"use client";

import { useCallback, useMemo, useState } from "react";
import type { BoardViewModel } from "@/hooks/use-board-view";
import {
  buildExportGrid,
  EXPORT_MIME_TYPES,
  exportFileName,
  pdfLinesFrom,
  selectExportColumns,
} from "@/lib/board-export";
import { toDelimited } from "@/lib/csv";
import { downloadBytes, downloadText } from "@/lib/dom/download";
import { buildPdf, pdfToBytes } from "@/lib/pdf";
import { buildXlsx } from "@/lib/xlsx";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { BoardRow, ExportFormat, ExportOutcome, ExportScope } from "@/types";

export interface ExportController {
  readonly rowCounts: Readonly<Record<ExportScope, number>>;
  readonly omittedColumns: readonly string[];
  readonly isExporting: boolean;
  readonly run: (format: ExportFormat, scope: ExportScope) => Promise<ExportOutcome | null>;
}

export interface ExportInput {
  readonly model: BoardViewModel;
  readonly selectedIds: readonly string[];
  readonly canViewSensitive: boolean;
}

export function useBoardExport({
  model,
  selectedIds,
  canViewSensitive,
}: ExportInput): ExportController {
  const rowsById = useBoardStore((state) => state.rowsById);
  const rowOrder = useBoardStore((state) => state.rowOrder);
  const pushFeedback = useWorkspaceStore((state) => state.pushFeedback);
  const [isExporting, setIsExporting] = useState(false);

  const selection = useMemo(
    () => selectExportColumns(model.columns, { canViewSensitive }),
    [model.columns, canViewSensitive],
  );

  const rowsFor = useCallback(
    (scope: ExportScope): readonly BoardRow[] => {
      const ids =
        scope === "board" ? rowOrder : scope === "view" ? model.rowIds : selectedIds;

      return ids
        .map((rowId) => rowsById[rowId])
        .filter((row): row is BoardRow => row !== undefined);
    },
    [rowOrder, model.rowIds, selectedIds, rowsById],
  );

  const rowCounts = useMemo(
    () => ({
      board: rowOrder.length,
      view: model.rowIds.length,
      selection: selectedIds.length,
    }),
    [rowOrder.length, model.rowIds.length, selectedIds.length],
  );

  const run = useCallback(
    async (format: ExportFormat, scope: ExportScope): Promise<ExportOutcome | null> => {
      const board = model.board;
      if (!board) return null;

      setIsExporting(true);

      try {
        const rows = rowsFor(scope);
        const grid = buildExportGrid({ columns: selection.columns, rows, context: model.context });
        const fileName = exportFileName(board.name, scope, format, new Date().toISOString());

        writeFile(format, fileName, grid, board.name);

        const outcome: ExportOutcome = {
          fileName,
          rowCount: rows.length,
          columnCount: selection.columns.length,
          omittedColumns: selection.omitted,
        };

        pushFeedback(
          selection.omitted.length === 0
            ? `Exported ${outcome.rowCount} records to ${fileName}`
            : `Exported ${outcome.rowCount} records to ${fileName} · ${selection.omitted.length} restricted column(s) left out`,
          "success",
        );

        return outcome;
      } finally {
        setIsExporting(false);
      }
    },
    [model.board, model.context, rowsFor, selection, pushFeedback],
  );

  return { rowCounts, omittedColumns: selection.omitted, isExporting, run };
}

function writeFile(
  format: ExportFormat,
  fileName: string,
  grid: readonly (readonly string[])[],
  boardName: string,
): void {
  if (format === "xlsx") {
    downloadBytes(buildXlsx(grid, boardName), fileName, EXPORT_MIME_TYPES.xlsx);
    return;
  }

  if (format === "csv") {
    downloadText(`﻿${toDelimited(grid)}`, fileName, EXPORT_MIME_TYPES.csv);
    return;
  }

  const pdf = buildPdf({ title: boardName, lines: pdfLinesFrom(grid) });
  downloadBytes(pdfToBytes(pdf), fileName, EXPORT_MIME_TYPES.pdf);
}
