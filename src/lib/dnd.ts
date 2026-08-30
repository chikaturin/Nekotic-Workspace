import type { DragEvent } from "react";
import { DND_NODE_MIME } from "@/config/app";
import type { DriveNodeType } from "@/types";

export interface DragPayload {
  readonly nodeId: string;
  readonly type: DriveNodeType;
  readonly name: string;
}

export function setDragPayload(event: DragEvent, payload: DragPayload): void {
  event.dataTransfer.setData(DND_NODE_MIME, JSON.stringify(payload));
  event.dataTransfer.setData("text/plain", payload.name);
  event.dataTransfer.effectAllowed = "move";
}

export function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DND_NODE_MIME);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDragPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isDragPayload(value: unknown): value is DragPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.nodeId === "string" && typeof candidate.name === "string";
}

export function hasInternalNode(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(DND_NODE_MIME);
}

export function hasExternalFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function readDroppedFiles(event: DragEvent): readonly File[] {
  return Array.from(event.dataTransfer.files ?? []);
}
