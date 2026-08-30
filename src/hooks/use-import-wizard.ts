"use client";

import { useCallback, useMemo, useState } from "react";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { delimiterFor, parseDelimited } from "@/lib/csv";
import { validateUpload } from "@/lib/file-validation";
import type { Grid } from "@/lib/grid";
import {
  autoMapColumns,
  isTruncated,
  planImport,
  unmappedBoardColumns,
  readImportSource,
  setMappingTarget,
} from "@/lib/import-mapping";
import { extensionOf } from "@/lib/node-visuals";
import { parseXlsx } from "@/lib/xlsx";
import { useBoardStore } from "@/store/board-store";
import { appError, toAppError } from "@/services/errors";
import type {
  AppError,
  BoardColumn,
  ColumnMapping,
  ImportInvalidPolicy,
  ImportOutcome,
  ImportPlan,
  ImportSource,
  ImportStep,
  MappingTarget,
} from "@/types";

export interface ImportWizard {
  readonly step: ImportStep;
  readonly source: ImportSource | null;
  readonly mappings: readonly ColumnMapping[];
  readonly hasHeaderRow: boolean;
  readonly plan: ImportPlan | null;
  readonly policy: ImportInvalidPolicy;
  readonly unmapped: readonly BoardColumn[];
  readonly isRemovingUnmapped: boolean;
  readonly setRemovingUnmapped: (remove: boolean) => void;
  readonly outcome: ImportOutcome | null;
  readonly error: AppError | null;
  readonly isBusy: boolean;
  readonly wasTruncated: boolean;
  readonly selectFile: (file: File) => Promise<void>;
  readonly setHasHeaderRow: (hasHeaderRow: boolean) => void;
  readonly setTarget: (sourceIndex: number, target: MappingTarget) => void;
  readonly setPolicy: (policy: ImportInvalidPolicy) => void;
  readonly goTo: (step: ImportStep) => void;
  readonly confirm: () => Promise<void>;
  readonly reset: () => void;
}

const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "csv", "tsv"]);

export function useImportWizard(model: BoardViewModel): ImportWizard {
  const importRows = useBoardStore((state) => state.importRows);

  const [step, setStep] = useState<ImportStep>("upload");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [hasHeaderRow, setHeaderRow] = useState(true);
  const [mappings, setMappings] = useState<readonly ColumnMapping[]>([]);
  const [policy, setPolicy] = useState<ImportInvalidPolicy>("skip");
  const [isRemovingUnmapped, setRemovingUnmapped] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const source = useMemo(
    () => (grid ? readImportSource({ fileName, sheetName, grid, hasHeaderRow }) : null),
    [grid, fileName, sheetName, hasHeaderRow],
  );

  const plan = useMemo(
    () =>
      source
        ? planImport({
            source,
            mappings,
            columns: model.columns,
            context: model.context,
          })
        : null,
    [source, mappings, model.columns, model.context],
  );

  const reset = useCallback(() => {
    setStep("upload");
    setGrid(null);
    setFile(null);
    setFileName("");
    setSheetName(null);
    setHeaderRow(true);
    setMappings([]);
    setPolicy("skip");
    setRemovingUnmapped(false);
    setOutcome(null);
    setError(null);
  }, []);

  const selectFile = useCallback(
    async (file: File) => {
      setError(null);
      setOutcome(null);

      const extension = extensionOf(file.name);
      if (!SPREADSHEET_EXTENSIONS.has(extension)) {
        setError(
          appError("validation", `“${file.name}” is not a spreadsheet`, {
            detail: "Import accepts .xlsx, .csv and .tsv files.",
            isRetryable: false,
          }),
        );
        return;
      }

      const rejection = validateUpload(file);
      if (rejection) {
        setError(rejection);
        return;
      }

      setIsBusy(true);

      try {
        const parsed =
          extension === "xlsx"
            ? await parseXlsx(new Uint8Array(await file.arrayBuffer()))
            : { rows: parseDelimited(await file.text(), delimiterFor(extension)), sheetName: null };

        setGrid(parsed.rows);
        setFile(file);
        setFileName(file.name);
        setSheetName(parsed.sheetName);
        setHeaderRow(true);

        const headers = readImportSource({
          fileName: file.name,
          grid: parsed.rows,
          hasHeaderRow: true,
        }).headers;

        setMappings(autoMapColumns(headers, model.columns));
        setStep("mapping");
      } catch (caught) {
        setError(toAppError(caught));
      } finally {
        setIsBusy(false);
      }
    },
    [model.columns],
  );

  return {
    step,
    source,
    mappings,
    hasHeaderRow,
    plan,
    policy,
    unmapped: unmappedBoardColumns(mappings, model.columns),
    isRemovingUnmapped,
    setRemovingUnmapped,
    outcome,
    error,
    isBusy,
    wasTruncated: grid ? isTruncated(grid, hasHeaderRow) : false,

    selectFile,

    setHasHeaderRow: useCallback(
      (next: boolean) => {
        setHeaderRow(next);
        if (!grid) return;

        const headers = readImportSource({ fileName, grid, hasHeaderRow: next }).headers;
        setMappings(autoMapColumns(headers, model.columns));
      },
      [grid, fileName, model.columns],
    ),

    setTarget: useCallback(
      (sourceIndex: number, target: MappingTarget) =>
        setMappings((current) => setMappingTarget(current, sourceIndex, target)),
      [],
    ),

    setPolicy,
    goTo: setStep,

    confirm: useCallback(async () => {
      if (!plan || plan.conflicts.length > 0 || !file) return;

      setIsBusy(true);
      setError(null);

      try {
        const outcome = await importRows({
          file,
          mappings,
          invalidPolicy: policy,
          ...(isRemovingUnmapped
            ? {
                removeColumnIds: unmappedBoardColumns(mappings, model.columns).map(
                  (column) => column.id,
                ),
              }
            : {}),
          hasHeaderRow,
        });

        if (!outcome) return;

        setOutcome({
          created: outcome.created,
          skipped: outcome.skipped,
          issues: plan.issues,
          rowIds: outcome.rowIds,
          ...(outcome.removedColumns === undefined
            ? {}
            : { removedColumns: outcome.removedColumns }),
        });
        setStep("result");
      } catch (caught) {
        setError(toAppError(caught));
      } finally {
        setIsBusy(false);
      }
    }, [
      plan,
      file,
      policy,
      mappings,
      hasHeaderRow,
      model.columns,
      isRemovingUnmapped,
      importRows,
    ]),

    reset,
  };
}
