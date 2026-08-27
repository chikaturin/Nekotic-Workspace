/**
 * Theme constants, in a module with no `"use client"` boundary.
 *
 * The boot script that applies the theme before first paint is a *server*
 * component. Importing a value from a client module into one yields a client
 * reference rather than the value, which silently compiled the storage key to
 * `undefined` and left the stored choice unreadable at boot. Keeping the
 * constants here means both sides read the same literal.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nexdrop-theme";

/** What the workspace looks like until someone explicitly chooses otherwise. */
export const DEFAULT_THEME: Theme = "dark";

/**
 * The pre-hydration script.
 *
 * Dark ships on `<html>` from the server, so this has one job: strip the class
 * when the stored choice is light. An unset preference stays dark, and the
 * whole thing is a no-op in private mode where storage throws.
 */
export function themeBootScript(): string {
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.classList.toggle("dark",s!=="light")}catch(e){}})();`;
}
