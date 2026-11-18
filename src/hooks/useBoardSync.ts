import { useEffect, useState } from "react";
import { useBoard } from "../store";
import { loadBoard, renameBoard, saveBoard } from "../boards";

export type SyncStatus = "loading" | "saved" | "saving" | "error" | "missing";

const snapshot = () => {
  const { objects, connectors, viewport } = useBoard.getState();
  return { objects, connectors, viewport };
};

const currentTheme = () => useBoard.getState().theme;

export function useBoardSync(uid: string, boardId: string) {
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [title, setTitle] = useState("");

  useEffect(() => {
    let cancelled = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub = () => {};

    const flush = async () => {
      dirty = false;
      try {
        await saveBoard(uid, boardId, snapshot(), currentTheme());
        if (!cancelled && !dirty) setStatus("saved");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    loadBoard(uid, boardId)
      .then((board) => {
        if (cancelled) return;
        if (!board) return setStatus("missing");
        setTitle(board.title);
        useBoard.getState().setBoard(board.content);
        setStatus("saved");

        let last = useBoard.getState();
        unsub = useBoard.subscribe((s) => {
          const changed =
            s.objects !== last.objects ||
            s.connectors !== last.connectors ||
            s.viewport !== last.viewport;
          last = s;
          if (!changed) return;
          dirty = true;
          setStatus("saving");
          clearTimeout(timer);
          timer = setTimeout(flush, 1000);
        });
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
      // save the last edit before the board is cleared (snapshot is taken right now)
      if (dirty) saveBoard(uid, boardId, snapshot(), currentTheme()).catch(() => {});
      useBoard.getState().resetBoard();
    };
  }, [uid, boardId]);

  const rename = (t: string) => renameBoard(uid, boardId, t);
  return { status, title, setTitle, rename };
}