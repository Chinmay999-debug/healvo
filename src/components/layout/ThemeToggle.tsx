import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../state/themeContext";

/**
 * Compact top-bar theme switch. Reads/writes the same ThemeProvider state
 * as Settings > Account's Appearance control (state/themeContext.tsx) — no
 * separate theme state. Toggling here always resolves to an explicit
 * light/dark preference (overriding "system" if that was selected), same
 * as picking Light/Dark directly in Settings would.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-muted)] outline-none transition-colors hover:bg-[var(--color-canvas)] focus-visible:ring-2 focus-visible:ring-[var(--color-teal)]/50"
    >
      {isDark ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
    </button>
  );
}
