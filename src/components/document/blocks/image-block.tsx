"use client";

import { ImageOff, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasExternalFiles, readDroppedFiles } from "@/lib/dnd";
import { IMAGE_ACCEPT_ATTRIBUTE } from "@/lib/file-validation";
import { cn } from "@/lib/utils";
import { fileService } from "@/services/file-service";
import { useUploadStore } from "@/store/upload-store";
import type { DocumentImage, ImageBlock as ImageBlockModel } from "@/types";

interface ImageBlockProps {
  readonly block: ImageBlockModel;
  readonly onChange: (block: ImageBlockModel) => void;
  readonly isEditable: boolean;
  /** Folder uploads are filed into — the page's own folder. */
  readonly folderId: string | null;
}

/**
 * A gallery block: add as many images as you like, click any of them to open
 * the full-page viewer. Uploads go through the shared upload store, so they
 * obey the same permission and validation rules as every other upload.
 */
export function ImageBlock({ block, onChange, isEditable, folderId }: ImageBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startUploads = useUploadStore((state) => state.startUploads);
  const [isUploading, setIsUploading] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<readonly string[]>([]);

  const images = block.images;

  async function addFiles(files: readonly File[]) {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const assets = await startUploads(files, folderId);
      const added = assets.reduce<readonly DocumentImage[]>((list, asset) => {
        const url = fileService.getAssetUrl(asset.id);
        return url ? [...list, { assetId: asset.id, url, alt: asset.name }] : list;
      }, []);

      if (added.length > 0) onChange({ ...block, images: [...block.images, ...added] });
    } finally {
      setIsUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange({ ...block, images: block.images.filter((_, position) => position !== index) });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    setIsOver(false);
    if (!isEditable || !hasExternalFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    void addFiles(readDroppedFiles(event));
  }

  const hasImages = images.length > 0;

  return (
    <figure className="space-y-2">
      <div
        onDragEnter={(event) => isEditable && hasExternalFiles(event) && setIsOver(true)}
        onDragOver={(event) => {
          if (!isEditable || !hasExternalFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg transition-colors",
          isOver && "outline outline-2 outline-offset-2 outline-accent",
        )}
      >
        {hasImages ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((image, index) => (
              <li key={`${image.url}-${index}`} className="group/tile relative">
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  aria-label={`Open ${image.alt || `image ${index + 1}`}`}
                  className="block w-full overflow-hidden rounded-lg border border-border bg-canvas focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {brokenUrls.includes(image.url) ? (
                    <span className="flex aspect-4/3 flex-col items-center justify-center gap-1.5 p-4 text-center">
                      <ImageOff className="size-5 text-faint-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        No longer available in this session
                      </span>
                    </span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element -- object URL from the upload service */
                    <img
                      src={image.url}
                      alt={image.alt || `Image ${index + 1}`}
                      onError={() => setBrokenUrls((urls) => [...urls, image.url])}
                      className="aspect-4/3 w-full object-cover transition-transform duration-200 group-hover/tile:scale-[1.02]"
                    />
                  )}
                </button>

                {isEditable && (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => removeAt(index)}
                    className="absolute right-1.5 top-1.5 opacity-0 shadow-md transition-opacity focus-visible:opacity-100 group-hover/tile:opacity-100"
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}

            {isEditable && (
              <li>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface/60 text-muted-foreground transition-colors hover:border-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isUploading ? (
                    <LoaderCircle className="size-5 animate-spin text-accent" />
                  ) : (
                    <Plus className="size-5" />
                  )}
                  <span className="text-[11px]">{isUploading ? "Uploading…" : "Add more"}</span>
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div
            className={cn(
              "flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-border bg-surface/60 p-8 text-center",
              !isEditable && "opacity-70",
            )}
          >
            <ImagePlus className="size-7 text-faint-foreground" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground">
              {isEditable ? "Drop images here, or add them from your computer" : "No images yet"}
            </p>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
                className="gap-1.5"
              >
                {isUploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
                {isUploading ? "Uploading…" : "Add images"}
              </Button>
            )}
          </div>
        )}
      </div>

      <figcaption className="flex items-center gap-2">
        <Input
          value={block.caption}
          readOnly={!isEditable}
          onChange={(event) => onChange({ ...block, caption: event.target.value })}
          placeholder="Add a caption…"
          aria-label="Image caption"
          className="h-7 border-transparent bg-transparent px-1 text-[12px] text-muted-foreground hover:border-border"
        />
        {hasImages && (
          <span className="metric shrink-0 text-[10px] text-faint-foreground">
            {images.length} {images.length === 1 ? "image" : "images"}
          </span>
        )}
      </figcaption>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void addFiles(files);
          event.target.value = "";
        }}
      />

      <ImageLightbox
        images={images}
        index={openIndex}
        caption={block.caption}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </figure>
  );
}
