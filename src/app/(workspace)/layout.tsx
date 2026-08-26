import { AppShell } from "@/components/layout/app-shell";

/** Every authenticated surface renders inside the workspace shell. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
