import type { ThemePreference } from "@/types";

/**
 * The theme preference lives in IndexedDB with every other setting, but is
 * *mirrored* here in localStorage.
 *
 * The reason is timing. IndexedDB reads are asynchronous, so the page would
 * paint before the app knew which theme to use, and a dark-mode user would see
 * a white flash on every navigation. localStorage is synchronous, so a tiny
 * script can read it and set the class before the browser paints anything.
 *
 * IndexedDB stays the source of truth; this is only a cache that happens to be
 * readable early enough to matter.
 */
export const THEME_STORAGE_KEY = "lyrics-translator:theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredTheme(): ThemePreference | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : null;
  } catch {
    // Private browsing modes can throw on localStorage access.
    return null;
  }
}

export function writeStoredTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // A failed mirror write only costs a flash on next load, so carry on.
  }
}

export function prefersDark(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Applies a preference by toggling the `dark` class Tailwind keys off. */
export function applyTheme(theme: ThemePreference): void {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Runs before first paint, inlined into the document head.
 *
 * Written as a string of plain ES5-ish JavaScript on purpose: it is injected
 * directly into the HTML, so it cannot import anything, cannot be bundled, and
 * must not throw even if storage is unavailable. Keep it tiny — it blocks
 * rendering by design, which is the whole point.
 */
export const themeInitScript = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();`;
