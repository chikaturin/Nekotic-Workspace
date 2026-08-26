/**
 * Minimal, spec-valid PDF generator used by the mock file service so PDF
 * previews work offline. Byte offsets in the xref table are computed exactly,
 * which keeps strict viewers (and PDF.js) happy.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface PdfDocumentInput {
  readonly title: string;
  readonly lines: readonly string[];
}

/** Build a single-page PDF as an ASCII string. */
export function buildPdf({ title, lines }: PdfDocumentInput): string {
  const body = [
    "BT",
    "/F1 22 Tf",
    `60 ${PAGE_HEIGHT - 80} Td`,
    `(${escapeText(title)}) Tj`,
    "ET",
    ...lines.flatMap((line, index) => [
      "BT",
      "/F1 12 Tf",
      `60 ${PAGE_HEIGHT - 130 - index * 20} Td`,
      `(${escapeText(line)}) Tj`,
      "ET",
    ]),
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];

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
