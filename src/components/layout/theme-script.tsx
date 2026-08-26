import { THEME_STORAGE_KEY } from "@/hooks/use-theme";

/**
 * Applies the stored theme before the first paint so there is no flash.
 * Light is the product default; an explicit choice always wins.
 */
export function ThemeScript() {
  const script = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=s==="dark";document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
