"use client";

import { ImageCanvas } from "@/components/shared/image-canvas";

interface ImagePreviewProps {
  readonly url: string;
  readonly alt: string;
}

/**
 * The image surface of the file viewer.
 *
 * Same canvas as the attachment viewer, so a screenshot behaves identically
 * whether it arrived as a file in a folder or as evidence on a record: zoom
 * around the cursor, drag to pan, Fit and 100% to get back.
 */
export function ImagePreview({ url, alt }: ImagePreviewProps) {
  return <ImageCanvas key={url} url={url} alt={alt} className="h-full" />;
}
