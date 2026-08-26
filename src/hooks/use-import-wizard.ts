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
  readImportSource,
  rowsToCreate,
  setMapping as applyMapping,
} from "@/lib/import-mapping";
import { extensionOf } from "@/lib/node-visuals";
import { parseXlsx } from "@/lib/xlsx";
import { useBoardStore } from "@/store/board-store";
import { appError, toAppError } from "@/services/errors";
import type {
  AppError,
  ColumnMapping,
  ImportInvalidPolicy,
  ImportOutcome,
  ImportPlan,
  ImportSource,
  ImportStep,
} from "@/types";

/**
 * The import wizard (SY-IMP-35): upload → map → validate → confirm → result.
 *
 * Everything before "confirm" is a computation over the parsed file: the board
 * is not touched until the user has seen exactly which rows would fail and
 * chosen what should happen to them.
 */

export interface ImportWizard {
  readonly step: ImportStep;
  readonly source: ImportSource | null;
  readonly mappings: readonly ColumnMapping[];
  readonly hasHeaderRow: boolean;
  readonly plan: ImportPlan | null;
  readonly policy: ImportInvalidPolicy;
  readonly outcome: ImportOutcome | null;
  readonly error: AppError | null;
  readonly isBusy: boolean;
  /** True when the file held more rows than one import may write. */
  readonly wasTruncated: boolean;
  readonly selectFile: (file: File) => Promise<void>;
  readonly setHasHeaderRow: (hasHeaderRow: boolean) => void;
  readonly setMapping: (sourceIndex: number, columnId: string | null) => void;
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
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [hasHeaderRow, setHeaderRow] = useState(true);
  const [mappings, setMappings] = useState<readonly ColumnMapping[]>([]);
  const [policy, setPolicy] = useState<ImportInvalidPolicy>("skip");
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
    setFileName("");
    setSheetName(null);
    setHeaderRow(true);
    setMappings([]);
    setPolicy("skip");
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
    outcome,
    error,
    isBusy,
    wasTruncated: grid ? isTruncated(grid, hasHeaderRow) : false,

    selectFile,

    /**
     * Toggling the header row changes what the columns are *called*, so the
     * guessed mapping is redone rather than left pointing at the old names.
     */
    setHasHeaderRow: useCallback(
      (next: boolean) => {
        setHeaderRow(next);
        if (!grid) return;

        const headers = readImportSource({ fileName, grid, hasHeaderRow: next }).headers;
        setMappings(autoMapColumns(headers, model.columns));
      },
      [grid, fileName, model.columns],
    ),

    setMapping: useCallback(
      (sourceIndex: number, columnId: string | null) =>
        setMappings((current) => applyMapping(current, sourceIndex, columnId)),
      [],
    ),

    setPolicy,
    goTo: setStep,

    confirm: useCallback(async () => {
      if (!plan) return;

      const rows = rowsToCreate(plan, policy, model.columns);
      if (rows.length === 0) {
        setOutcome({ created: 0, skipped: plan.drafts.length, issues: plan.issues, rowIds: [] });
        setStep("result");
        return;
      }

      setIsBusy(true);

      try {
        const created = await importRows(rows);
        setOutcome({
          created: created?.length ?? 0,
          skipped: plan.drafts.length - rows.length,
          issues: plan.issues,
          rowIds: created?.map((row) => row.id) ?? [],
        });
        setStep("result");
      } finally {
        setIsBusy(false);
      }
    }, [plan, policy, model.columns, importRows]),

    reset,
  };
}
