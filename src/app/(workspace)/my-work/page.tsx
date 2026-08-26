import type { Metadata } from "next";
import { MyWorkPage } from "@/components/my-work/my-work-page";

export const metadata: Metadata = { title: "My Work" };

export default function Page() {
  return <MyWorkPage />;
}
