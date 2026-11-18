import {
  addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BoardContent } from "./store";

export type BoardMeta = { id: string; title: string; updatedAt: Date };

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

export const saveBoard = (uid: string, id: string, content: BoardContent) =>
  updateDoc(doc(col(uid), id), {
    content: JSON.stringify(content),
    updatedAt: serverTimestamp(),
  });

export const renameBoard = (uid: string, id: string, title: string) =>
  updateDoc(doc(col(uid), id), { title: title.trim() || "Untitled board" });

export const deleteBoard = (uid: string, id: string) => deleteDoc(doc(col(uid), id));

export function watchBoards(uid: string, cb: (boards: BoardMeta[]) => void) {
  const q = query(col(uid), orderBy("updatedAt", "desc"), limit(24));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        title: d.data().title,
        updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
      }))
    )
  );
}