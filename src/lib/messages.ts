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
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "./firebase";
import { appPath } from "./paths";
import { DeviceType, Message, MessageType } from "./types";

const PAGE_SIZE_MOBILE = 30;
const PAGE_SIZE_DESKTOP = 60;
const MAX_TEXT_LENGTH = 2000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 180;

const FILE_TYPE_ALLOWLIST = new Set(["application/pdf", "text/plain"]);

const isImage = (file: File) => file.type.startsWith("image/");
const isVideo = (file: File) => file.type.startsWith("video/");

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

const mapMessage = (docSnap: QueryDocumentSnapshot<DocumentData>): Message => {
  const data = docSnap.data();
  const type = (data.type as MessageType) ?? "text";

  const base = {
    id: docSnap.id,
    createdAt: data.createdAt ?? null,
    device: (data.device as DeviceType) ?? "desktop",
    starred: Boolean(data.starred)
  };

  if (type === "image" || type === "video" || type === "file") {
    return {
      ...base,
      type,
      text: typeof data.text === "string" ? data.text : "",
      fileURL: typeof data.fileURL === "string" ? data.fileURL : "",
      fileName: typeof data.fileName === "string" ? data.fileName : "archivo",
      fileType: typeof data.fileType === "string" ? data.fileType : null,
      storagePath: typeof data.storagePath === "string" ? data.storagePath : "",
      size: typeof data.size === "number" ? data.size : 0
    };
  }

  return {
    ...base,
    type: type === "link" ? "link" : "text",
    text: typeof data.text === "string" ? data.text : "",
    fileURL: null,
    fileName: null,
    fileType: null,
    storagePath: null,
    size: null
  };
};

const normalizeText = (value: string) => value.trim();

const validateTextLength = (value: string, label: string) => {
  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error(`${label} supera el máximo de ${MAX_TEXT_LENGTH} caracteres.`);
  }
};

const validateFile = (file: File) => {
  if (!file.size) {
    throw new Error("El archivo está vacío.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("El archivo supera el límite de 20 MB.");
  }

  if (file.name.length > MAX_FILE_NAME_LENGTH) {
    throw new Error("El nombre del archivo es demasiado largo.");
  }

  if (!file.type) {
    return;
  }

  const isAllowed =
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    FILE_TYPE_ALLOWLIST.has(file.type);

  if (!isAllowed) {
    throw new Error("Tipo de archivo no permitido.");
  }
};

const buildTextPayload = (value: string) => {
  const text = normalizeText(value);
  if (!text) return null;

  validateTextLength(text, "El mensaje");

  return {
    type: detectLink(text) ? "link" : "text",
    text,
    fileURL: null,
    fileName: null,
    fileType: null,
    storagePath: null,
    createdAt: serverTimestamp(),
    device: deviceType(),
    size: null,
    starred: false
  };
};

const buildFilePayload = (type: MessageType, url: string, storagePath: string, file: File, caption: string) => {
  const normalizedCaption = normalizeText(caption);
  validateTextLength(normalizedCaption, "El texto adjunto");

  return {
    type,
    text: normalizedCaption,
    fileURL: url,
    fileName: file.name,
    fileType: file.type || null,
    storagePath,
    createdAt: serverTimestamp(),
    device: deviceType(),
    size: file.size,
    starred: false
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
    (snapshot) => {
      const messages = snapshot.docs.map(mapMessage).reverse();
      cb({
        messages,
        lastVisibleDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
        pageSize,
        changes: snapshot.docChanges()
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

export const sendTextMessage = async (uid: string, value: string) => {
  const payload = buildTextPayload(value);
  if (!payload) return;

  const msgRef = doc(messagesCollection(uid));
  await setDoc(msgRef, payload);
};

export const sendFileMessageWithProgress = async (
  uid: string,
  file: File,
  caption = "",
  onProgress?: (value: number) => void
) => {
  validateFile(file);

  const msgRef = doc(messagesCollection(uid));
  const storagePath = `user-files/${uid}/${msgRef.id}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (!onProgress) return;
        const value = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(value);
      },
      reject,
      () => resolve()
    );
  });

  const url = await getDownloadURL(storageRef);
  const type: MessageType = isImage(file) ? "image" : isVideo(file) ? "video" : "file";
  const payload = buildFilePayload(type, url, storagePath, file, caption);

  await setDoc(msgRef, payload);
};

export const toggleMessageStar = async (uid: string, messageId: string, starred: boolean) => {
  await updateDoc(doc(messagesCollection(uid), messageId), {
    starred: !starred
  });
};

export const deleteMessageAndAsset = async (uid: string, message: Message) => {
  if (message.storagePath) {
    try {
      await deleteObject(ref(storage, message.storagePath));
    } catch {
      // Si el archivo ya no existe, igual permitimos borrar el documento.
    }
  }

  await deleteDoc(doc(messagesCollection(uid), message.id));
};
