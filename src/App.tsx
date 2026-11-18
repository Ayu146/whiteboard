import { useEffect } from "react";
import Board from "./components/Board";
import Toolbar from "./components/Toolbar";
import ThemeToggle from "./components/ThemeToggle";
import { useBoard } from "./store";

export default function App() {
  const theme = useBoard((s) => s.theme);

  // apply the theme to the page and remember it
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // storage unavailable, ignore
    }
  }, [theme]);

  return (
    <>
      {/* theme toggle sits above the toolbar as its own separate pill */}
      <div
        style={{
          position: "fixed",
          left: 20,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}
      >
        <ThemeToggle />
        <Toolbar />
      </div>
      <Board />
    </>
  );
}