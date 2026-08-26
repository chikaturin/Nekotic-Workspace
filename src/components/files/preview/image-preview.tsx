"use client";

import { motion } from "framer-motion";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImagePreviewProps {
  readonly url: string;
  readonly alt: string;
}

/** Fills the viewer; click (or the control) switches between fit and 1:1. */
export function ImagePreview({ url, alt }: ImagePreviewProps) {
  const [isActualSize, setIsActualSize] = useState(false);

  return (
    <div className={cn("relative h-full w-full", isActualSize ? "overflow-auto" : "overflow-hidden")}>
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "flex min-h-full min-w-full items-center justify-center p-6",
          isActualSize && "w-max",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- object URL / data URI, no loader involved */}
        <img
          src={url}
          alt={alt}
          onClick={() => setIsActualSize((actual) => !actual)}
          className={cn(
            "rounded-lg border border-border bg-surface object-contain shadow-xl",
            isActualSize ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in",
          )}
        />
      </motion.div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsActualSize((actual) => !actual)}
        aria-pressed={isActualSize}
        className="absolute bottom-4 right-4 gap-1.5 shadow-lg"
      >
        {isActualSize ? <ZoomOut /> : <ZoomIn />}
        {isActualSize ? "Fit" : "Actual size"}
      </Button>
    </div>
  );
}
