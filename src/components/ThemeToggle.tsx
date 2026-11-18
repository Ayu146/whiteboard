import { Sun, Moon } from "lucide-react";
import { useBoard } from "../store";

export default function ThemeToggle() {
  const theme = useBoard((s) => s.theme);
  const toggleTheme = useBoard((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <div
      style={{
        padding: 6,
        background: "var(--surface)",
        borderRadius: 14,
        boxShadow: "0 4px 16px var(--shadow)",
        transition: "background 0.25s, box-shadow 0.25s",
      }}
    >
      <button
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          background: "transparent",
          color: "var(--primary)",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        {isDark ? (
          <Sun size={20} strokeWidth={1.75} />
        ) : (
          <Moon size={20} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}