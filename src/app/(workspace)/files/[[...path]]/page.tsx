import type { Metadata } from "next";
import { FilesView } from "@/components/files/files-view";
import { nodePathChains } from "@/lib/static-paths";

interface FilesPageProps {
  readonly params: Promise<{ path?: string[] }>;
}

export async function generateMetadata({ params }: FilesPageProps): Promise<Metadata> {
  const { path = [] } = await params;
  const current = path[path.length - 1];

  return { title: current ? `Files · ${decodeURIComponent(current)}` : "Files" };
}

export function generateStaticParams() {
  return nodePathChains().map((path) => ({ path: [...path] }));
}

export default async function FilesPage({ params }: FilesPageProps) {
  const { path = [] } = await params;

  return <FilesView segments={path.map(decodeURIComponent)} />;
}
