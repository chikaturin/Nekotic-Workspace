import type { Metadata } from "next";
import { CollectionView } from "@/components/drive/collection-view";

export const metadata: Metadata = { title: "favorites" };

export default function Page() {
  return <CollectionView viewId="favorites" />;
}
