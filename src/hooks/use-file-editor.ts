"use client";

import { useDraftEditor, type DraftEditor } from "@/hooks/use-draft-editor";
import type { Grid } from "@/lib/grid";
import { fileService } from "@/services/file-service";
import type { FileNode } from "@/types";

export type FileEditorController = DraftEditor<string>;
export type SheetEditorController = DraftEditor<Grid>;

export function useFileEditor(node: FileNode, content: string): FileEditorController {
  return useDraftEditor(node, content, fileService.saveText);
}

const sameGrid = (a: Grid, b: Grid) => JSON.stringify(a) === JSON.stringify(b);

export function useSheetEditor(node: FileNode, rows: Grid): SheetEditorController {
  return useDraftEditor(node, rows, fileService.saveSheet, { isEqual: sameGrid });
}
