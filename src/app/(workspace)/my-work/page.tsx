import type { Metadata } from "next";
import { CollectionView } from "@/components/drive/collection-view";

export const metadata: Metadata = { title: "my work" };

export default function Page() {
  return <CollectionView viewId="my-work" />;
}
