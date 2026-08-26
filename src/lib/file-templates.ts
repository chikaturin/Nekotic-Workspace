import type { FileKind } from "@/types";

/** A blank file the workspace can create without an upload. */
export interface FileTemplate {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly kind: FileKind;
  readonly baseName: string;
}

export const FILE_TEMPLATES: readonly FileTemplate[] = [
  {
    id: "text",
    label: "Text file",
    description: "Plain .txt notes",
    extension: "txt",
    mimeType: "text/plain",
    kind: "document",
    baseName: "Untitled",
  },
  {
    id: "markdown",
    label: "Markdown",
    description: "Formatted .md document",
    extension: "md",
    mimeType: "text/markdown",
    kind: "document",
    baseName: "Untitled",
  },
  {
    id: "csv",
    label: "Spreadsheet",
    description: "Editable .csv grid",
    extension: "csv",
    mimeType: "text/csv",
    kind: "spreadsheet",
    baseName: "Untitled",
  },
  {
    id: "xlsx",
    label: "Excel workbook",
    description: "Real .xlsx workbook",
    extension: "xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "spreadsheet",
    baseName: "Untitled",
  },
  {
    id: "json",
    label: "JSON",
    description: "Structured .json data",
    extension: "json",
    mimeType: "application/json",
    kind: "code",
    baseName: "Untitled",
  },
];

export function templateById(id: string): FileTemplate | undefined {
  return FILE_TEMPLATES.find((template) => template.id === id);
}

/** `Untitled.csv`, then `Untitled 2.csv` — never collide with a sibling. */
export function templateFileName(template: FileTemplate, taken: readonly string[]): string {
  const candidate = `${template.baseName}.${template.extension}`;
  if (!taken.includes(candidate)) return candidate;

  let suffix = 2;
  while (taken.includes(`${template.baseName} ${suffix}.${template.extension}`)) suffix += 1;
  return `${template.baseName} ${suffix}.${template.extension}`;
}

/** Seed content so a new file opens with something to edit, not a void. */
export const TEXT_SEEDS: Readonly<Record<string, string>> = {
  text: "",
  markdown: "# Untitled\n\n",
  json: "{\n  \n}\n",
};

export const SHEET_SEED: readonly (readonly string[])[] = [
  ["Column A", "Column B", "Column C"],
  ["", "", ""],
  ["", "", ""],
  ["", "", ""],
];
