export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "self-chat-theme";

const readStoredTheme = (): ThemeMode | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
};

const detectSystemTheme = (): ThemeMode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const getInitialTheme = (): ThemeMode => readStoredTheme() ?? detectSystemTheme();

export const applyTheme = (theme: ThemeMode) => {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
};
