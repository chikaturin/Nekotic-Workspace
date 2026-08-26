import type { Metadata } from "next";
import { TrashPage } from "@/components/collections/trash-page";

export const metadata: Metadata = { title: "Trash" };

export default function Page() {
  return <TrashPage />;
}
