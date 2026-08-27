"use client";

import { useCallback, useMemo, useState } from "react";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { delimiterFor, parseDelimited } from "@/lib/csv";
import { validateUpload } from "@/lib/file-validation";
import type { Grid } from "@/lib/grid";
import {
  autoMapColumns,
  isTruncated,
  newColumnDrafts,
  planImport,
  unmappedBoardColumns,
  readImportSource,
  resolveProvisionalIds,
  rowsToCreate,
  setMappingTarget,
  planColumns,
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

/**
 * The import wizard (SY-IMP-35): upload → map → validate → confirm → result.
 *
 * Everything before "confirm" is a computation over the parsed file: the board
 * is not touched until the user has seen exactly which rows would fail and
 * chosen what should happen to them.
 *
 * Confirm writes in two stages — the columns the mapping asks for, then the
 * records — because a record cannot carry a value for a column that does not
 * exist yet. The columns are created first, their real ids replace the
 * provisional ones the plan was drafted against, and only then do the rows go.
 */

export interface ImportWizard {
  readonly step: ImportStep;
  readonly source: ImportSource | null;
  readonly mappings: readonly ColumnMapping[];
  readonly hasHeaderRow: boolean;
  readonly plan: ImportPlan | null;
  readonly policy: ImportInvalidPolicy;
  /** Board columns this import writes nothing into — offered for removal. */
  readonly unmapped: readonly BoardColumn[];
  readonly isRemovingUnmapped: boolean;
  readonly setRemovingUnmapped: (remove: boolean) => void;
  readonly outcome: ImportOutcome | null;
  readonly error: AppError | null;
  readonly isBusy: boolean;
  /** True when the file held more rows than one import may write. */
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
  const addColumn = useBoardStore((state) => state.addColumn);
  const deleteColumn = useBoardStore((state) => state.deleteColumn);

  const [step, setStep] = useState<ImportStep>("upload");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [hasHeaderRow, setHeaderRow] = useState(true);
  const [mappings, setMappings] = useState<readonly ColumnMapping[]>([]);
  const [policy, setPolicy] = useState<ImportInvalidPolicy>("skip");
  /**
   * Off by default, and deliberately.
   *
   * Dropping a column takes its value off every record already on the board.
   * That is a reasonable thing to want when a file defines the real schema, and
   * never a reasonable thing to do because nobody said otherwise.
   */
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

    setTarget: useCallback(
      (sourceIndex: number, target: MappingTarget) =>
        setMappings((current) => setMappingTarget(current, sourceIndex, target)),
      [],
    ),

    setPolicy,
    goTo: setStep,

    confirm: useCallback(async () => {
      if (!plan || plan.conflicts.length > 0) return;

      setIsBusy(true);
      setError(null);

      /** Drop the board columns the file had nothing for, by name for the report. */
      const removeColumns = async (): Promise<readonly string[]> => {
        const doomed = unmappedBoardColumns(mappings, model.columns);
        for (const column of doomed) await deleteColumn(column.id);
        return doomed.map((column) => column.name);
      };

      try {
        // Columns first, in file order, so a new column lands where the file
        // puts it rather than in whatever order the promises settle.
        const realIdBySourceIndex = new Map<number, string>();

        for (const draft of newColumnDrafts(mappings)) {
          const created = await addColumn(draft.type, draft.name.trim());
          if (!created) {
            setError(
              appError("conflict", `Could not create the “${draft.name.trim()}” column`, {
                detail: "Nothing was imported. Map that column onto an existing one and try again.",
                isRetryable: false,
              }),
            );
            return;
          }

          realIdBySourceIndex.set(draft.sourceIndex, created.id);
        }

        const drafted = rowsToCreate(plan, policy, planColumns(mappings, model.columns));
        const rows = resolveProvisionalIds(drafted, realIdBySourceIndex);

        if (rows.length === 0) {
          setOutcome({
            created: 0,
            skipped: plan.drafts.length,
            issues: plan.issues,
            rowIds: [],
          });
          setStep("result");
          return;
        }

        const created = await importRows(rows);

        // Columns go last, and only once the records are safely in. A failed
        // import must never be the thing that emptied the board's schema.
        const removed = isRemovingUnmapped ? await removeColumns() : [];

        setOutcome({
          created: created?.length ?? 0,
          skipped: plan.drafts.length - rows.length,
          issues: plan.issues,
          rowIds: created?.map((row) => row.id) ?? [],
          removedColumns: removed,
        });
        setStep("result");
      } catch (caught) {
        setError(toAppError(caught));
      } finally {
        setIsBusy(false);
      }
    }, [plan, policy, mappings, model.columns, isRemovingUnmapped, addColumn, deleteColumn, importRows]),

    reset,
  };
}
