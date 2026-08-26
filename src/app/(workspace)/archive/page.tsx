import type { Metadata } from "next";
import { ArchivePage } from "@/components/collections/archive-page";

export const metadata: Metadata = { title: "Archive" };

export default function Page() {
  return <ArchivePage />;
}
