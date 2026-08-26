import type { Metadata } from "next";
import { CollectionView } from "@/components/drive/collection-view";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return <CollectionView viewId="archive" />;
}
