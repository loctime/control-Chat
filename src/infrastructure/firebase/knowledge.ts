import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { DocumentRecord, Note } from "../../domain/entities";

const notesCollection = (workspaceId: string) => collection(db, "workspaces", workspaceId, "notes");
const documentsCollection = (workspaceId: string) => collection(db, "workspaces", workspaceId, "documents");

const noteSort = (items: Note[]) =>
  [...items].sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));

const documentSort = (items: DocumentRecord[]) =>
  [...items].sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));

const mapNote = (docSnap: QueryDocumentSnapshot<DocumentData>): Note => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : "Nota sin titulo",
    content: typeof data.content === "string" ? data.content : "",
    status: data.status === "archived" ? "archived" : "active",
    tagIds: Array.isArray(data.tagIds) ? data.tagIds.filter((item): item is string => typeof item === "string") : [],
    sourceMessageId: typeof data.sourceMessageId === "string" ? data.sourceMessageId : null,
    documentId: typeof data.documentId === "string" ? data.documentId : null,
    summary: typeof data.summary === "string" ? data.summary : null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null
  };
};

const mapDocument = (docSnap: QueryDocumentSnapshot<DocumentData>): DocumentRecord => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    title: typeof data.title === "string" ? data.title : "Documento sin titulo",
    content: typeof data.content === "string" ? data.content : "",
    editorType: data.editorType === "blocks" ? "blocks" : "plain",
    summary: typeof data.summary === "string" ? data.summary : null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null
  };
};

export const subscribeToNotes = (
  workspaceId: string,
  uid: string,
  cb: (notes: Note[]) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    query(notesCollection(workspaceId), where("ownerId", "==", uid), orderBy("updatedAt", "desc")),
    (snapshot) => cb(noteSort(snapshot.docs.map(mapNote))),
    (error) => onError(error)
  );

export const subscribeToDocuments = (
  workspaceId: string,
  uid: string,
  cb: (documents: DocumentRecord[]) => void,
  onError: (error: Error) => void
) =>
  onSnapshot(
    query(documentsCollection(workspaceId), where("ownerId", "==", uid), orderBy("updatedAt", "desc")),
    (snapshot) => cb(documentSort(snapshot.docs.map(mapDocument))),
    (error) => onError(error)
  );

export const createNote = async (workspaceId: string, uid: string) => {
  const ref = await addDoc(notesCollection(workspaceId), {
    workspaceId,
    ownerId: uid,
    title: "Nueva nota",
    content: "",
    status: "active",
    tagIds: [],
    sourceMessageId: null,
    documentId: null,
    summary: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
};

export const updateNote = async (
  workspaceId: string,
  noteId: string,
  input: Pick<Note, "title" | "content">
) => {
  await updateDoc(doc(notesCollection(workspaceId), noteId), {
    title: input.title,
    content: input.content,
    updatedAt: serverTimestamp()
  });
};

export const createDocument = async (workspaceId: string, uid: string) => {
  const ref = await addDoc(documentsCollection(workspaceId), {
    workspaceId,
    ownerId: uid,
    title: "Nuevo documento",
    content: "",
    editorType: "plain",
    summary: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
};

export const updateDocument = async (
  workspaceId: string,
  documentId: string,
  input: Pick<DocumentRecord, "title" | "content">
) => {
  await updateDoc(doc(documentsCollection(workspaceId), documentId), {
    title: input.title,
    content: input.content,
    updatedAt: serverTimestamp()
  });
};
