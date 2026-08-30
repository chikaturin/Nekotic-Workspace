import type { StepNumbering } from "@/types";

export const DEFAULT_STEP_NUMBERING: StepNumbering = {
  enabled: false,
  prefix: "",
  start: 1,
  separator: ":",
};

export function stepNumberingOf(config: { readonly stepNumbering?: StepNumbering }): StepNumbering {
  return config.stepNumbering ?? DEFAULT_STEP_NUMBERING;
}

/**
 * Dòng bước "chung chung": đoán lấy tiền tố chữ cái, rồi tới số.
 *
 * Nó KHÔNG đọc được tiền tố có dấu như `STEP-`, nên khi cột đã khai tiền tố
 * riêng thì `prefixPattern` bên dưới được thử trước.
 */
const STEP_LINE = /^([ \t]*)([A-Za-z][A-Za-z ]{0,7}?)?(\d+)([.):\-\]]?[ \t]*)(.*)$/;

export interface ParsedStep {
  readonly indent: string;
  readonly prefix: string;
  readonly number: number;
  readonly separator: string;
  /** Phần sau dấu phân cách, GIỮ NGUYÊN khoảng trắng. */
  readonly body: string;
  /** `body` đã trim — đây mới là "nội dung" theo nghĩa người dùng hiểu. */
  readonly content: string;
  /**
   * Bước này đã được viết chưa.
   *
   * Đây là thứ quyết định có tăng số hay không: một bước rỗng KHÔNG đẩy bộ đếm,
   * nếu không thì gõ Enter vài lần là số nhảy qua những bước chưa ai viết.
   */
  readonly hasContent: boolean;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Regex khớp ĐÚNG tiền tố và dấu phân cách mà cột đã khai. */
function prefixPattern(config: StepNumbering): RegExp | null {
  const prefix = config.prefix;
  const separator = config.separator.trim();

  if (prefix === "" && separator === "") return null;

  return new RegExp(
    `^([ \\t]*)(${escapeRegExp(prefix)})(\\d+)(${escapeRegExp(separator)})([ \\t]*)(.*)$`,
  );
}

function build(
  indent: string,
  prefix: string,
  rawNumber: string,
  separator: string,
  body: string,
): ParsedStep | null {
  const number = Number.parseInt(rawNumber, 10);
  if (!Number.isFinite(number)) return null;

  const content = body.trim();

  return { indent, prefix, number, separator, body, content, hasContent: content.length > 0 };
}

/**
 * Đọc một dòng thành các phần của nó, hoặc `null` nếu đó không phải dòng bước.
 *
 * Truyền `config` vào để đọc được tiền tố mà regex chung không đoán nổi
 * (`STEP-`, `Case_`…). Không có config thì rơi về cách đoán cũ.
 */
export function parseStepLine(line: string, config?: StepNumbering): ParsedStep | null {
  if (config) {
    const exact = prefixPattern(config)?.exec(line);

    if (exact) {
      return build(exact[1] ?? "", exact[2] ?? "", exact[3] ?? "", exact[4] ?? "", exact[6] ?? "");
    }
  }

  const match = STEP_LINE.exec(line);
  if (!match) return null;

  return build(match[1] ?? "", match[2] ?? "", match[3] ?? "", match[4] ?? "", match[5] ?? "");
}

export function stepToken(config: StepNumbering, number: number): string {
  const separator = config.separator.trim();
  return `${config.prefix}${number}${separator}${separator ? " " : ""}`;
}

/**
 * Bước hợp lệ gần nhất TỪ con trỏ NGƯỢC LÊN.
 *
 * Con trỏ không phải lúc nào cũng nằm trên một dòng bước: Shift+Enter đẻ ra
 * dòng nối tiếp ("+Kho" thụt lề dưới B2), và những dòng đó không mang số. Chỉ
 * nhìn đúng một dòng dưới con trỏ thì gặp dòng nối tiếp là mất dấu, và số quay
 * về đầu — B1 mọc ra giữa danh sách.
 */
function stepBefore(
  text: string,
  caret: number,
  config: StepNumbering,
): { parsed: ParsedStep; isCurrentLine: boolean } | null {
  const upto = text.slice(0, Math.max(0, caret));
  const lines = upto.split("\n");

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseStepLine(lines[index] ?? "", config);

    if (parsed) return { parsed, isCurrentLine: index === lines.length - 1 };
  }

  return null;
}

/**
 * Phần văn bản cần chèn khi người dùng bấm Enter — chuỗi rỗng nghĩa là KHÔNG
 * chèn gì.
 *
 * Số suy ra từ bước thật gần nhất phía trên, không phải từ số dòng và cũng
 * không phải từ mỗi dòng đang đứng. Đứng trên một bước còn rỗng thì Enter đứng
 * yên — số chỉ đi tiếp khi bước đó đã được viết.
 */
export function nextStepInsertion(text: string, caret: number, config: StepNumbering): string {
  const found = stepBefore(text, caret, config);

  if (!found) {
    const separator = config.separator.trim();

    return `\n${config.prefix}${config.start}${separator}${separator ? " " : ""}`;
  }

  const { parsed, isCurrentLine } = found;

  // Bước hiện tại chưa viết gì: giữ nguyên, để nội dung gõ tiếp thuộc về nó.
  // Chỉ áp dụng khi con trỏ ĐANG ở trên chính dòng đó — đứng ở dòng nối tiếp
  // nghĩa là bước phía trên đã có nội dung để mà nối.
  if (isCurrentLine && !parsed.hasContent) return "";

  const separator = parsed.separator.trim();
  const prefix = parsed.prefix === "" ? config.prefix : parsed.prefix;

  return `\n${parsed.indent}${prefix}${parsed.number + 1}${separator}${separator ? " " : ""}`;
}

export function openingText(
  existing: string,
  typed: string | undefined,
  config: StepNumbering,
): string {
  const base = typed ?? existing;
  if (!config.enabled) return base;

  const isFresh = typed !== undefined || existing.trim().length === 0;
  if (!isFresh || parseStepLine(base) !== null) return base;

  return `${stepToken(config, config.start)}${base}`;
}

export function spacesAfter(text: string, caret: number): number {
  return /^[ \t]*/.exec(text.slice(caret))?.[0].length ?? 0;
}

export function lineAt(text: string, caret: number): string {
  const upto = text.slice(0, Math.max(0, caret));
  const start = upto.lastIndexOf("\n") + 1;
  return upto.slice(start);
}

export const INDENT = "    ";

export interface TextEdit {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
}

function lineSpan(text: string, start: number, end: number): { from: number; to: number } {
  const from = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const after = text.indexOf("\n", end);
  return { from, to: after === -1 ? text.length : after };
}

function isMultiLine(text: string, start: number, end: number): boolean {
  return start !== end && text.slice(start, end).includes("\n");
}

export function indentSelection(text: string, start: number, end: number): TextEdit {
  if (!isMultiLine(text, start, end)) {
    return {
      text: `${text.slice(0, start)}${INDENT}${text.slice(end)}`,
      selectionStart: start + INDENT.length,
      selectionEnd: start + INDENT.length,
    };
  }

  const { from, to } = lineSpan(text, start, end);
  const lines = text.slice(from, to).split("\n");
  const indented = lines.map((line) => `${INDENT}${line}`).join("\n");

  return {
    text: `${text.slice(0, from)}${indented}${text.slice(to)}`,
    selectionStart: start + INDENT.length,
    selectionEnd: end + INDENT.length * lines.length,
  };
}

function outdentWidth(line: string): number {
  if (line.startsWith("\t")) return 1;

  const spaces = /^ {1,4}/.exec(line)?.[0].length ?? 0;
  return spaces;
}

export function outdentSelection(text: string, start: number, end: number): TextEdit {
  const { from, to } = lineSpan(text, start, end);
  const lines = text.slice(from, to).split("\n");

  let firstRemoved = 0;
  let totalRemoved = 0;

  const outdented = lines.map((line, index) => {
    const width = outdentWidth(line);
    if (index === 0) firstRemoved = width;
    totalRemoved += width;
    return line.slice(width);
  });

  if (totalRemoved === 0) return { text, selectionStart: start, selectionEnd: end };

  const lineStart = from;
  return {
    text: `${text.slice(0, from)}${outdented.join("\n")}${text.slice(to)}`,
    selectionStart: Math.max(lineStart, start - firstRemoved),
    selectionEnd: Math.max(lineStart, end - totalRemoved),
  };
}

export function numberPastedLines(text: string, config: StepNumbering): string | null {
  const lines = text.split(/\r?\n/);
  const filled = lines.filter((line) => line.trim().length > 0);
  if (filled.length < 2) return null;
  if (filled.some((line) => parseStepLine(line) !== null)) return null;

  let number = config.start;

  return lines
    .map((line) => {
      if (line.trim().length === 0) return line;
      const numbered = `${stepToken(config, number)}${line.trim()}`;
      number += 1;
      return numbered;
    })
    .join("\n");
}

export function looksLikeSteps(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return false;

  return lines.every((line) => parseStepLine(line) !== null);
}

export function formatSteps(text: string, config: StepNumbering): string {
  if (!looksLikeSteps(text)) return text;

  let number = config.start;

  return text
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim().length === 0) return "";

      const parsed = parseStepLine(line);
      if (!parsed) return line;

      const body = parsed.body.trim();
      const numbered = `${stepToken(config, number)}${body}`;
      number += 1;
      return numbered;
    })
    .join("\n");
}

export function canFormatSteps(text: string, config: StepNumbering): boolean {
  return looksLikeSteps(text) && formatSteps(text, config) !== text;
}
