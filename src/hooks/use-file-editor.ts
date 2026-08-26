"use client";

import { useDraftEditor, type DraftEditor } from "@/hooks/use-draft-editor";
import type { Grid } from "@/lib/grid";
import { fileService } from "@/services/file-service";
import type { FileNode } from "@/types";

export type FileEditorController = DraftEditor<string>;
export type SheetEditorController = DraftEditor<Grid>;

/** Edit a text, Markdown or source file in place. */
export function useFileEditor(node: FileNode, content: string): FileEditorController {
  return useDraftEditor(node, content, fileService.saveText);
}

/** Grids are rebuilt on every keystroke, so equality is structural. */
const sameGrid = (a: Grid, b: Grid) => JSON.stringify(a) === JSON.stringify(b);

/** Edit a CSV, TSV or XLSX file as a grid. */
export function useSheetEditor(node: FileNode, rows: Grid): SheetEditorController {
  return useDraftEditor(node, rows, fileService.saveSheet, { isEqual: sameGrid });
}
