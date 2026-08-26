/**
 * Minimal ZIP reader/writer — enough for the XLSX container.
 *
 * Entries are written uncompressed (method 0), which every spreadsheet app
 * accepts and keeps writing synchronous. Reading handles both stored and
 * deflated entries; inflation uses the platform's `DecompressionStream`, so no
 * compression library is needed.
 */

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
const VERSION = 20;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a ZIP archive from entries, storing each one uncompressed. */
export function zipSync(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => ({
    name: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }));

  const localSize = prepared.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = prepared.reduce((total, entry) => total + 46 + entry.name.length, 0);

  const output = new Uint8Array(new ArrayBuffer(localSize + centralSize + EOCD_SIZE));
  const view = new DataView(output.buffer);
  const offsets: number[] = [];
  let cursor = 0;

  for (const entry of prepared) {
    offsets.push(cursor);

    view.setUint32(cursor, LOCAL_SIGNATURE, true);
    view.setUint16(cursor + 4, VERSION, true);
    view.setUint16(cursor + 6, 0, true);
    view.setUint16(cursor + 8, METHOD_STORED, true);
    view.setUint32(cursor + 10, 0, true); // time + date: a fixed epoch keeps output stable
    view.setUint32(cursor + 14, entry.crc, true);
    view.setUint32(cursor + 18, entry.data.length, true);
    view.setUint32(cursor + 22, entry.data.length, true);
    view.setUint16(cursor + 26, entry.name.length, true);
    view.setUint16(cursor + 28, 0, true);
    cursor += 30;

    output.set(entry.name, cursor);
    cursor += entry.name.length;
    output.set(entry.data, cursor);
    cursor += entry.data.length;
  }

  const centralStart = cursor;

  prepared.forEach((entry, index) => {
    view.setUint32(cursor, CENTRAL_SIGNATURE, true);
    view.setUint16(cursor + 4, VERSION, true);
    view.setUint16(cursor + 6, VERSION, true);
    view.setUint16(cursor + 8, 0, true);
    view.setUint16(cursor + 10, METHOD_STORED, true);
    view.setUint32(cursor + 12, 0, true);
    view.setUint32(cursor + 16, entry.crc, true);
    view.setUint32(cursor + 20, entry.data.length, true);
    view.setUint32(cursor + 24, entry.data.length, true);
    view.setUint16(cursor + 28, entry.name.length, true);
    view.setUint16(cursor + 30, 0, true);
    view.setUint16(cursor + 32, 0, true);
    view.setUint16(cursor + 34, 0, true);
    view.setUint16(cursor + 36, 0, true);
    view.setUint32(cursor + 38, 0, true);
    view.setUint32(cursor + 42, offsets[index] ?? 0, true);
    cursor += 46;

    output.set(entry.name, cursor);
    cursor += entry.name.length;
  });

  view.setUint32(cursor, EOCD_SIGNATURE, true);
  view.setUint16(cursor + 4, 0, true);
  view.setUint16(cursor + 6, 0, true);
  view.setUint16(cursor + 8, prepared.length, true);
  view.setUint16(cursor + 10, prepared.length, true);
  view.setUint32(cursor + 12, cursor - centralStart, true);
  view.setUint32(cursor + 16, centralStart, true);
  view.setUint16(cursor + 20, 0, true);

  return output;
}

/** Read an archive into `name → bytes`. Throws when the container is invalid. */
export async function unzip(bytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(view, bytes.byteLength);
  if (eocd < 0) throw new Error("Not a ZIP archive");

  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    files.set(name, method === METHOD_DEFLATE ? await inflateRaw(raw) : raw);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function findEocd(view: DataView, length: number): number {
  for (let offset = length - EOCD_SIZE; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser cannot read compressed spreadsheets");
  }

  const stream = new Blob([toArrayBufferView(data)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Copy into a plain `ArrayBuffer` view — subarrays of a pooled buffer are not blob-safe. */
function toArrayBufferView(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(data.byteLength));
  copy.set(data);
  return copy;
}
