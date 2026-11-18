import Board from "./components/Board";
import Toolbar from "./components/Toolbar";
import ThemeToggle from "./components/ThemeToggle";

export default function Workspace() {
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