import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  type DocumentChange,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { appPath } from "./paths";
import { DeviceType, Message, ReplyTarget } from "./types";

const PAGE_SIZE_MOBILE = 30;
const PAGE_SIZE_DESKTOP = 60;
const MAX_TEXT_LENGTH = 2000;

const detectLink = (value: string) => {
  const urlRegex = /^(https?:\/\/[^\s]+)$/i;
  return urlRegex.test(value.trim());
};

const resolvePageSize = () =>
  window.matchMedia("(max-width: 768px)").matches ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;

const deviceType = (): DeviceType =>
  window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";

const toEpoch = (message: Message) => {
  const seconds = message.createdAt?.seconds ?? 0;
  const nanos = message.createdAt?.nanoseconds ?? 0;
  return seconds * 1_000_000_000 + nanos;
};

const mapReply = (data: DocumentData) => ({
  replyToId: typeof data.replyToId === "string" ? data.replyToId : null,
  replyToText: typeof data.replyToText === "string" ? data.replyToText : null,
  replyToAuthor: typeof data.replyToAuthor === "string" ? data.replyToAuthor : null
});

const mapMessage = (docSnap: QueryDocumentSnapshot<DocumentData>): Message => {
  const data = docSnap.data();
  // Documentos viejos podian tener type "image" / "video" / "file"; los degradamos
  // a "text" porque la app ya no soporta archivos. Mostramos el caption (text) o,
  // si esta vacio, el fileName como fallback para no perder contexto.
  const rawType = (data.type as string) ?? "text";
  const type: Message["type"] = rawType === "link" ? "link" : "text";
  const rawText = typeof data.text === "string" ? data.text : "";
  const text = rawText || (typeof data.fileName === "string" ? data.fileName : "");

  return {
    id: docSnap.id,
    type,
    text,
    createdAt: data.createdAt ?? null,
    device: (data.device as DeviceType) ?? "desktop",
    starred: Boolean(data.starred),
    author: typeof data.author === "string" ? data.author : "Anonimo",
    pending: docSnap.metadata.hasPendingWrites,
    clientId: typeof data.clientId === "string" ? data.clientId : null,
    ...mapReply(data)
  };
};

const normalizeText = (value: string) => value.trim();

const validateTextLength = (value: string, label: string) => {
  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error(`${label} supera el maximo de ${MAX_TEXT_LENGTH} caracteres.`);
  }
};

const mapReplyPayload = (replyTo?: ReplyTarget | null) => {
  if (!replyTo) return {};

  return {
    replyToId: replyTo.id,
    replyToText: replyTo.text,
    replyToAuthor: replyTo.author
  };
};

const buildTextPayload = (value: string, author: string, replyTo?: ReplyTarget | null) => {
  const text = normalizeText(value);
  if (!text) return null;

  validateTextLength(text, "El mensaje");

  return {
    type: detectLink(text) ? "link" : "text",
    text,
    createdAt: serverTimestamp(),
    device: deviceType(),
    starred: false,
    author,
    ...mapReplyPayload(replyTo)
  };
};

const messagesCollection = (uid: string) => collection(db, ...appPath, "users", uid, "messages");

export interface LatestMessagesPayload {
  messages: Message[];
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
  pageSize: number;
  changes: DocumentChange<DocumentData>[];
}

export const subscribeToLatestMessages = (
  uid: string,
  cb: (payload: LatestMessagesPayload) => void,
  onError: (error: Error) => void
) => {
  const pageSize = resolvePageSize();
  const q = query(messagesCollection(uid), orderBy("createdAt", "desc"), limit(pageSize));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const messages = snapshot.docs.map(mapMessage).reverse();
      cb({
        messages,
        lastVisibleDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        pageSize,
        changes: snapshot.docChanges({ includeMetadataChanges: true })
      });
    },
    (error) => onError(error)
  );
};

export const fetchOlderMessages = async (
  uid: string,
  oldestDoc: QueryDocumentSnapshot<DocumentData> | null
) => {
  if (!oldestDoc) {
    return { docs: [] as QueryDocumentSnapshot<DocumentData>[], messages: [] as Message[], pageSize: resolvePageSize() };
  }

  const pageSize = resolvePageSize();
  const q = query(messagesCollection(uid), orderBy("createdAt", "desc"), startAfter(oldestDoc), limit(pageSize));
  const snap = await getDocs(q);

  return {
    docs: snap.docs,
    messages: snap.docs.map(mapMessage).reverse(),
    pageSize
  };
};

export const applyMessageChanges = (current: Message[], changes: DocumentChange<DocumentData>[]) => {
  const nextById = new Map(current.map((message) => [message.id, message]));

  for (const change of changes) {
    const nextMessage = mapMessage(change.doc);
    if (change.type === "removed") {
      nextById.delete(change.doc.id);
      continue;
    }
    nextById.set(change.doc.id, nextMessage);
  }

  return [...nextById.values()].sort((a, b) => toEpoch(a) - toEpoch(b));
};

export const sendTextMessage = (
  uid: string,
  value: string,
  author: string,
  replyTo?: ReplyTarget | null,
  clientId?: string
): Promise<void> => {
  const payload = buildTextPayload(value, author, replyTo);
  if (!payload) return Promise.resolve();

  const msgRef = clientId ? doc(messagesCollection(uid), clientId) : doc(messagesCollection(uid));
  const finalPayload = clientId ? { ...payload, clientId } : payload;
  return setDoc(msgRef, finalPayload);
};

export { MAX_TEXT_LENGTH };

export const toggleMessageStar = async (uid: string, messageId: string, starred: boolean) => {
  await updateDoc(doc(messagesCollection(uid), messageId), {
    starred: !starred
  });
};

export const deleteMessage = async (uid: string, messageId: string) => {
  await deleteDoc(doc(messagesCollection(uid), messageId));
};
