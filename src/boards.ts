import {
  addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BoardContent } from "./store";
import type { Theme } from "./types";
import { makeThumbnail } from "./utils/thumbnail";

export type BoardMeta = { id: string; title: string; updatedAt: Date; thumb: string };

const col = (uid: string) => collection(db, "users", uid, "boards");

const EMPTY: BoardContent = {
  objects: {},
  connectors: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};

export async function createBoard(uid: string) {
  const ref = await addDoc(col(uid), {
    title: "Untitled board",
    content: JSON.stringify(EMPTY),
    thumb: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function loadBoard(uid: string, id: string) {
  const snap = await getDoc(doc(col(uid), id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { title: d.title as string, content: JSON.parse(d.content) as BoardContent };
}

// saves the board together with a small picture of it for the home page
export async function saveBoard(uid: string, id: string, content: BoardContent, theme: Theme) {
  let thumb = "";
  try {
    thumb = await makeThumbnail(content, theme);
  } catch {
    // the preview is optional, never block saving
  }
  await updateDoc(doc(col(uid), id), {
    content: JSON.stringify(content),
    thumb,
    updatedAt: serverTimestamp(),
  });
}

export const renameBoard = (uid: string, id: string, title: string) =>
  updateDoc(doc(col(uid), id), { title: title.trim() || "Untitled board" });

export const deleteBoard = (uid: string, id: string) => deleteDoc(doc(col(uid), id));

export function watchBoards(uid: string, cb: (boards: BoardMeta[]) => void) {
  const q = query(col(uid), orderBy("updatedAt", "desc"), limit(48));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        title: d.data().title,
        thumb: (d.data().thumb as string) ?? "",
        updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
      }))
    )
  );
}