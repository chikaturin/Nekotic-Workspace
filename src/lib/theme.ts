
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nekotic-theme";

export const DEFAULT_THEME: Theme = "dark";

export function themeBootScript(): string {
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.classList.toggle("dark",s!=="light")}catch(e){}})();`;
}
