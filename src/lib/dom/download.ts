/**
 * Handing bytes to the browser.
 *
 * One place owns the anchor dance so every download — a stored file, an
 * exported board — behaves the same and revokes what it allocates.
 */

/** Point the browser at a URL it should save rather than navigate to. */
export function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Save bytes we generated ourselves. The object URL is released on the next
 * frame — immediately would race the click in Safari.
 */
export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);

  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(text: string, fileName: string, mimeType: string): void {
  downloadBytes(new TextEncoder().encode(text), fileName, mimeType);
}
