import type { Metadata } from "next";
import { DriveView } from "@/components/drive/drive-view";
import { nodePathChains } from "@/lib/static-paths";

interface DrivePageProps {
  readonly params: Promise<{ path?: string[] }>;
}

export async function generateMetadata({ params }: DrivePageProps): Promise<Metadata> {
  const { path = [] } = await params;
  const current = path[path.length - 1];

  return { title: current ? decodeURIComponent(current) : "Drive" };
}

export function generateStaticParams() {
  return nodePathChains().map((path) => ({ path: [...path] }));
}

export default async function DrivePage({ params }: DrivePageProps) {
  const { path = [] } = await params;
  const segments = path.map(decodeURIComponent);

  return <DriveView segments={segments} />;
}
