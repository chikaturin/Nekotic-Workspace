import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/layout/theme-script";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Projects, boards and files in one workspace. Drive Mode gives every team a shared, navigable file tree.",
};

/**
 * The theme is the app's own setting, not the OS's, so the browser chrome
 * follows the default rather than `prefers-color-scheme`.
 */
export const viewport: Viewport = {
  themeColor: "#1f2430",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Dark is the default, rendered on the server so the first paint is
    // already dark; the boot script only strips it for an explicit light choice.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
