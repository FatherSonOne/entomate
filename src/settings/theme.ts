import type { AccentMode, ThemeMode } from "./settingsTypes";

export function getSystemTheme(): "light" | "dark" {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeToDom(themeMode: ThemeMode) {
  const root = document.documentElement;
  const actual = themeMode === "system" ? getSystemTheme() : themeMode;
  root.dataset.theme = actual; // CSS can key off [data-theme="dark"]
  if (actual === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function applyAccentToDom(accentMode: AccentMode, accentColor: string) {
  const root = document.documentElement;

  // "Match system color" for accent == 'system' means: default app accent.
  // Default chosen based on your existing blue usage.
  const color = accentMode === "system" ? "#2563EB" : (accentColor || "#2563EB");

  root.style.setProperty("--color-accent", color);
}
