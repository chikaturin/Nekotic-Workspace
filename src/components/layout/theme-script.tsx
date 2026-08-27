import { themeBootScript } from "@/lib/theme";

/**
 * Applies the stored theme before the first paint so there is no flash.
 *
 * The script text comes from `lib/theme` rather than from the client hook:
 * this is a server component, and a value imported across a `"use client"`
 * boundary arrives as a reference, not a string.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />;
}
