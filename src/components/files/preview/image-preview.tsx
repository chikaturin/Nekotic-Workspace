"use client";

import { ImageCanvas } from "@/components/shared/image-canvas";

interface ImagePreviewProps {
  readonly url: string;
  readonly alt: string;
}

export function ImagePreview({ url, alt }: ImagePreviewProps) {
  return <ImageCanvas key={url} url={url} alt={alt} className="h-full" />;
}
