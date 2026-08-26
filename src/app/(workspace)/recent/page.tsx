import type { Metadata } from "next";
import { RecentPage } from "@/components/collections/recent-page";

export const metadata: Metadata = { title: "Recent" };

export default function Page() {
  return <RecentPage />;
}
