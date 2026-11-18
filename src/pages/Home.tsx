import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  LogOut,
  Layers,
  Cloud,
  Zap,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useBoard } from "../store";
import { createBoard, deleteBoard, renameBoard, watchBoards, type BoardMeta } from "../boards";
import "./Home.css";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(d: Date) {
  const s = (d.getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
  return "just now";
}

const thumbSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Home() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useBoard((s) => s.theme);
  const toggleTheme = useBoard((s) => s.toggleTheme);

  const [boards, setBoards] = useState<BoardMeta[] | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) {
      setBoards(null);
      return;
    }
    return watchBoards(user.uid, setBoards);
  }, [user]);

  const newBoard = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      navigate(`/board/${await createBoard(user.uid)}`);
    } finally {
      setCreating(false);
    }
  };

  const shown = (boards ?? []).filter((b) =>
    b.title.toLowerCase().includes(search.trim().toLowerCase())
  );
  const firstName = user?.displayName?.split(" ")[0];

  return (
    <div className="hm-page">
      <header className="hm-header">
        <div className="hm-brand">
          <span className="hm-logo">
            <Layers size={18} />
          </span>
          Whiteboard
        </div>

        <div className="hm-right">
          <button
            className="hm-icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {!loading &&
            (user ? (
              <div className="hm-user">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                )}
                <button className="hm-btn" onClick={logout}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : (
              <button className="hm-btn hm-btn-primary" onClick={login}>
                <GoogleIcon /> Sign in
              </button>
            ))}
        </div>
      </header>

      {loading ? null : !user ? (
        <main className="hm-hero">
          <h1>
            Think, sketch and plan <span>on an endless canvas</span>
          </h1>
          <p>
            Draw shapes, connect ideas and drop in images. Your boards are saved to your account
            and open on any device.
          </p>
          <button className="hm-btn hm-btn-primary hm-btn-lg" onClick={login}>
            <GoogleIcon /> Continue with Google
          </button>
          <div className="hm-features">
            <div>
              <Cloud size={20} />
              <b>Synced everywhere</b>
              <span>Start on one device, continue on another.</span>
            </div>
            <div>
              <Zap size={20} />
              <b>Autosave</b>
              <span>Every change is saved as you work.</span>
            </div>
            <div>
              <Layers size={20} />
              <b>Endless canvas</b>
              <span>Shapes, text, connectors and images.</span>
            </div>
          </div>
        </main>
      ) : (
        <main className="hm-main">
          <div className="hm-top">
            <div>
              <h2>{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</h2>
              <p>Pick up where you left off.</p>
            </div>
            <label className="hm-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search boards"
                aria-label="Search boards"
              />
            </label>
          </div>

          <h3 className="hm-section">Recent</h3>

          {boards === null ? (
            <p className="hm-note">Loading your boards…</p>
          ) : (
            <div className="hm-grid">
              <button className="hm-card hm-new" onClick={newBoard} disabled={creating}>
                <div className="hm-thumb hm-new-thumb">
                  <span>
                    <Plus size={26} />
                  </span>
                </div>
                <div className="hm-meta">
                  <strong>{creating ? "Creating…" : "New board"}</strong>
                  <span>Start with a blank canvas</span>
                </div>
              </button>

              {shown.map((b) => (
                <article
                  key={b.id}
                  className="hm-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/board/${b.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/board/${b.id}`)}
                >
                  <div className="hm-thumb">
                    {b.thumb ? (
                      <img src={thumbSrc(b.thumb)} alt="" draggable={false} />
                    ) : (
                      <div className="hm-empty">
                        <Layers size={28} />
                      </div>
                    )}
                    <div className="hm-actions">
                      <button
                        title="Rename"
                        aria-label="Rename board"
                        onClick={(e) => {
                          e.stopPropagation();
                          const name = prompt("Rename board", b.title);
                          if (name !== null) renameBoard(user.uid, b.id, name);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        title="Delete"
                        aria-label="Delete board"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete “${b.title}”? This can't be undone.`))
                            deleteBoard(user.uid, b.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="hm-meta">
                    <strong title={b.title}>{b.title}</strong>
                    <span>Edited {timeAgo(b.updatedAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {boards !== null && boards.length > 0 && shown.length === 0 && (
            <p className="hm-note">No boards match “{search}”.</p>
          )}
        </main>
      )}
    </div>
  );
}