import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { createBoard, deleteBoard, watchBoards, type BoardMeta } from "../boards";

export default function Home() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardMeta[] | null>(null);

  useEffect(() => {
    if (!user) {
      setBoards(null);
      return;
    }
    return watchBoards(user.uid, setBoards);
  }, [user]);

  const newBoard = async () => {
    if (!user) return;
    navigate(`/board/${await createBoard(user.uid)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #fff)", color: "var(--text, #111)", padding: "24px clamp(16px, 5vw, 64px)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Whiteboard</h1>
        {!loading &&
          (user ? (
            <button onClick={logout} style={btn}>
              <LogOut size={16} /> Sign out ({user.displayName?.split(" ")[0] ?? "you"})
            </button>
          ) : (
            <button onClick={login} style={{ ...btn, background: "var(--primary, #4f46e5)", color: "#fff" }}>
              <LogIn size={16} /> Sign in with Google
            </button>
          ))}
      </header>

      {loading ? null : !user ? (
        <p style={{ opacity: 0.7 }}>Sign in to create whiteboards and open them on any device.</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Recent whiteboards</h2>
            <button onClick={newBoard} style={{ ...btn, background: "var(--primary, #4f46e5)", color: "#fff" }}>
              <Plus size={16} /> New board
            </button>
          </div>

          {boards === null ? (
            <p style={{ opacity: 0.7 }}>Loading…</p>
          ) : boards.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No boards yet. Click “New board” to start.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {boards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/board/${b.id}`)}
                  style={{ cursor: "pointer", padding: 16, borderRadius: 14, background: "var(--surface, #f4f4f5)", boxShadow: "0 2px 10px rgba(0,0,0,.08)" }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.65, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Edited {b.updatedAt.toLocaleString()}</span>
                    <button
                      aria-label="Delete board"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete “${b.title}”?`)) deleteBoard(user.uid, b.id);
                      }}
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const btn = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
  border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
  background: "var(--surface, #f4f4f5)", color: "inherit",
} as const;