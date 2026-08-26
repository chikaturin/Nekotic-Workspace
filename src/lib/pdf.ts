/**
 * Minimal, spec-valid PDF generator used by the mock file service so PDF
 * previews work offline, and by board export (SY-EXP-36).
 *
 * Byte offsets in the xref table are computed exactly, which keeps strict
 * viewers (and PDF.js) happy. Long documents paginate: a report that runs to a
 * thousand records produces a thousand *readable* lines rather than one page
 * with everything after the thirty-second drawn off the bottom edge.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 60;
const BODY_BOTTOM = 56;
const LINE_HEIGHT = 20;

const TITLE_SIZE = 22;
const BODY_SIZE = 12;

const TITLE_BASELINE = PAGE_HEIGHT - 80;
/** First page leaves room for the title; later pages start higher. */
const FIRST_BODY_TOP = PAGE_HEIGHT - 130;
const BODY_TOP = PAGE_HEIGHT - 72;

const FIRST_PAGE_LINES = Math.floor((FIRST_BODY_TOP - BODY_BOTTOM) / LINE_HEIGHT) + 1;
const PAGE_LINES = Math.floor((BODY_TOP - BODY_BOTTOM) / LINE_HEIGHT) + 1;

/**
 * The base-14 Helvetica encoding this writer targets is a single byte wide, so
 * anything above U+00FF has no glyph. Substituting is honest; emitting a byte
 * that renders as a different letter is not.
 */
function toLatin1(value: string): string {
  return [...value].map((char) => (char.codePointAt(0)! <= 0xff ? char : "?")).join("");
}

function escapeText(value: string): string {
  return toLatin1(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function textAt(x: number, y: number, size: number, value: string): readonly string[] {
  return ["BT", `/F1 ${size} Tf`, `${x} ${y} Td`, `(${escapeText(value)}) Tj`, "ET"];
}

export interface PdfDocumentInput {
  readonly title: string;
  readonly lines: readonly string[];
}

/** Split the body so the first page can carry the title. */
function paginate(lines: readonly string[]): readonly (readonly string[])[] {
  const pages: (readonly string[])[] = [lines.slice(0, FIRST_PAGE_LINES)];

  for (let index = FIRST_PAGE_LINES; index < lines.length; index += PAGE_LINES) {
    pages.push(lines.slice(index, index + PAGE_LINES));
  }

  return pages;
}

/** Build a paginated PDF as an ASCII string. */
export function buildPdf({ title, lines }: PdfDocumentInput): string {
  const pages = paginate(lines);

  // 1 catalog · 2 pages · 3 font, then a page and a content stream per sheet.
  const firstPageObject = 4;
  const pageIds = pages.map((_, index) => firstPageObject + index * 2);

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  pages.forEach((pageLines, pageIndex) => {
    const contentsId = pageIds[pageIndex]! + 1;
    const top = pageIndex === 0 ? FIRST_BODY_TOP : BODY_TOP;

    const body = [
      ...(pageIndex === 0 ? textAt(MARGIN_X, TITLE_BASELINE, TITLE_SIZE, title) : []),
      ...pageLines.flatMap((line, index) =>
        textAt(MARGIN_X, top - index * LINE_HEIGHT, BODY_SIZE, line),
      ),
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentsId} 0 R >>`,
      `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    );
  });

  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let pdf = header;

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  const entries = offsets
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join("");

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

/** Encode the PDF for a Blob — every byte is ASCII by construction. */
export function pdfToBytes(pdf: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(pdf.length));
  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index) & 0xff;
  }
  return bytes;
}
