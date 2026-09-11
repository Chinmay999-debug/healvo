import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Frontend-only theme preference — light/dark/system, persisted to
// localStorage. This is the single source of truth for Healvo's theme:
// it resolves "system" against the OS media query and stamps the result
// as a `data-theme` attribute on <html>, which is all index.css's dark
// token block (see :root[data-theme="dark"]) needs to re-theme the entire
// app. No backend/Supabase involvement — see index.html's inline script
// for the matching pre-paint read that avoids a flash of the wrong theme
// on first load.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "healvo-theme";

interface ThemeContextValue {
  /** The user's stored preference — may be "system". */
  theme: ThemePreference;
  /** The actual light/dark theme currently applied (system resolved). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to system.
  }
  return "system";
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? getSystemTheme() : theme,
  );

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only — the preference still applies for this session.
    }
  }, []);

  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);

    if (theme !== "system") return;

    // Respond live if the OS preference changes while "System" is selected.
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const next: ResolvedTheme = mql.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyResolvedTheme(next);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
