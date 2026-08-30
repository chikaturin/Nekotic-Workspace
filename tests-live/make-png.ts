import { deflateSync } from "node:zlib";

/**
 * Sinh một PNG HỢP LỆ ngay lúc chạy.
 *
 * Không dùng base64 chép tay: một chuỗi gõ sai vẫn "trông như" PNG và vẫn
 * upload được, nhưng libvips sẽ từ chối đọc — và vì đường sinh webp cố ý
 * fail-soft (ghi cảnh báo, giữ file gốc, trả `null`), lỗi đó hiện ra y hệt
 * "tính năng chưa chạy". Sinh bằng encoder thật thì không có cửa nhầm.
 *
 * Ảnh đủ lớn để bước resize thật sự phải làm gì đó: 1200×800 thì bản thumbnail
 * 480px và bản preview 2048px là hai kết quả khác nhau, khác cả ảnh gốc.
 */

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

/**
 * Chép sang một `ArrayBuffer` riêng.
 *
 * `Buffer` của Node dùng chung một pool và kiểu của nó là `ArrayBufferLike`, có
 * thể là `SharedArrayBuffer` — `BlobPart` từ chối kiểu đó. Chép ra một buffer
 * riêng vừa hết lỗi kiểu, vừa tránh việc cắt nhầm vào pool dùng chung.
 */
const detach = (bytes: Buffer): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
};

/**
 * PNG RGB 8-bit, kích thước cho trước, vẽ gradient để không bị nén về gần 0.
 *
 * Trả `Uint8Array` chứ không phải `Buffer`: `Buffer` của Node có thể nằm trên
 * `SharedArrayBuffer`, mà `BlobPart` thì không nhận — và `new Blob([...])` là
 * đúng thứ `fileApi.sendBytes` cần.
 */
export function makePng(width = 1200, height = 800): Uint8Array<ArrayBuffer> {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  // 10..12 = compression / filter / interlace, đều là 0.

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type "None"
    for (let x = 0; x < width; x += 1) {
      const p = rowStart + 1 + x * 3;
      raw[p] = (x * 255) / width;
      raw[p + 1] = (y * 255) / height;
      raw[p + 2] = ((x + y) * 255) / (width + height);
    }
  }

  return detach(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
