import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useBoardSync } from "../hooks/useBoardSync";
import Workspace from "../Workspace";

const cover = {
  position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center",
  background: "var(--bg, #fff)", color: "var(--text-2, #666)", textAlign: "center",
} as const;

function BoardScreen({ uid, boardId }: { uid: string; boardId: string }) {
  const { status, title, setTitle, rename } = useBoardSync(uid, boardId);

  if (status === "missing" || (status === "error" && !title)) {
    return (
      <div style={cover}>
        <div>
          <p>{status === "missing" ? "This board doesn't exist." : "Couldn't open this board."}</p>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  const label = { loading: "Loading…", saving: "Saving…", saved: "Saved", error: "Couldn't save", missing: "" }[status];

  return (
    <>
      <Workspace />
      <div
        style={{
          position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 30,
          display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px",
          background: "var(--surface, #fff)", borderRadius: 14, boxShadow: "0 4px 16px rgba(0,0,0,.15)",
        }}
      >
        <Link to="/" aria-label="Back to home" style={{ display: "grid", placeItems: "center", width: 32, height: 32, color: "inherit" }}>
          <ArrowLeft size={18} />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => rename(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Board name"
          maxLength={60}
          style={{ width: 180, border: "none", background: "transparent", fontWeight: 700, fontSize: 14, color: "inherit" }}
        />
        <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
      </div>
      {status === "loading" && <div style={cover}>Loading board…</div>}
    </>
  );
}

export default function BoardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  if (!id || !user) return <Navigate to="/" replace />;
  return <BoardScreen key={id} uid={user.uid} boardId={id} />;
}