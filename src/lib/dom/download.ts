
export function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

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
