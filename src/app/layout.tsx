import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/layout/theme-script";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: "Projects, boards and files in one workspace",
};
export const viewport: Viewport = {
  themeColor: "#1f2430",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
