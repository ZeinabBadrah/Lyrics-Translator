"use client";

import { useEffect } from "react";

import { getSettings } from "@/lib/db";
import { applyTheme, readStoredTheme, writeStoredTheme } from "@/lib/theme";

/**
 * Keeps the rendered theme in step with the stored preference.
 *
 * The inline script in the root layout has already applied whatever
 * localStorage said, so this component is not responsible for the initial
 * paint. It handles the two cases the script cannot:
 *
 *  1. The localStorage mirror is missing or stale — for instance on a browser
 *     where the user set their preference before the mirror existed. IndexedDB
 *     is the source of truth, so it wins and the mirror is rewritten.
 *  2. The OS switches between light and dark while the app is open, which only
 *     matters when the preference is "system".
 *
 * Renders nothing.
 */
export function ThemeManager() {
  useEffect(() => {
    let cancelled = false;

    void getSettings()
      .then((settings) => {
        if (cancelled) return;
        if (readStoredTheme() !== settings.theme) {
          writeStoredTheme(settings.theme);
          applyTheme(settings.theme);
        }
      })
      .catch(() => {
        // Storage being unreadable is not worth interrupting the page for; the
        // theme simply stays as the inline script left it.
      });

    const media = matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      // Re-read rather than close over a value: the Settings page may have
      // changed the preference since this effect ran.
      applyTheme(readStoredTheme() ?? "system");
    };

    media.addEventListener("change", handleSystemChange);

    return () => {
      cancelled = true;
      media.removeEventListener("change", handleSystemChange);
    };
  }, []);

  return null;
}
