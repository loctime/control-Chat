import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  type DocumentChange,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../../lib/firebase";
import { AttachmentRecord, Message, MessageStatus, ReplyTarget } from "../../domain/entities";

const PAGE_SIZE_MOBILE = 30;
const PAGE_SIZE_DESKTOP = 60;
const MAX_TEXT_LENGTH = 2000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 180;
const FILE_TYPE_ALLOWLIST = new Set(["application/pdf", "text/plain"]);

const isImage = (file: File) => file.type.startsWith("image/");
const isVideo = (file: File) => file.type.startsWith("video/");
const detectLink = (value: string) => /^(https?:\/\/[^\s]+)$/i.test(value.trim());
const resolvePageSize = () =>
  window.matchMedia("(max-width: 768px)").matches ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
const deviceType = () => (window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop");
const messagesCollection = (workspaceId: string, conversationId: string) =>
  collection(db, "workspaces", workspaceId, "conversations", conversationId, "messages");
const attachmentsCollection = (workspaceId: string) =>
  collection(db, "workspaces", workspaceId, "attachments");

const normalizeText = (value: string) => value.trim();

const validateTextLength = (value: string, label: string) => {
  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error(`${label} supera el maximo de ${MAX_TEXT_LENGTH} caracteres.`);
  }
};

const validateFile = (file: File) => {
  if (!file.size) throw new Error("El archivo esta vacio.");
  if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera el limite de 20 MB.");
  if (file.name.length > MAX_FILE_NAME_LENGTH) throw new Error("El nombre del archivo es demasiado largo.");
  if (!file.type) throw new Error("El archivo no tiene tipo MIME valido.");

  const isAllowed =
    file.type.startsWith("image/") || file.type.startsWith("video/") || FILE_TYPE_ALLOWLIST.has(file.type);

  if (!isAllowed) throw new Error("Tipo de archivo no permitido.");
};

const mapReactions = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([emoji, users]) => [
      emoji,
      Array.isArray(users) ? users.filter((uid) => typeof uid === "string") : []
    ])
  );
};

const mapReactionCounts = (value: unknown) => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, count]) => typeof count === "number")
  ) as Message["reactionCounts"];
};

const toEpoch = (message: Message) => {
  const seconds = message.createdAt?.seconds ?? 0;
  const nanos = message.createdAt?.nanoseconds ?? 0;
  return seconds * 1_000_000_000 + nanos;
};

const mapMessage = (docSnap: QueryDocumentSnapshot<DocumentData>): Message => {
  const data = docSnap.data();
  const attachmentPreview =
    data.attachmentPreview && typeof data.attachmentPreview === "object"
      ? (data.attachmentPreview as Partial<AttachmentRecord>)
      : null;
  const authorSnapshot =
    data.authorSnapshot && typeof data.authorSnapshot === "object"
      ? {
          displayName:
            typeof data.authorSnapshot.displayName === "string"
              ? data.authorSnapshot.displayName
              : typeof data.author === "string"
              ? data.author
              : "Anonimo",
          avatarUrl: typeof data.authorSnapshot.avatarUrl === "string" ? data.authorSnapshot.avatarUrl : null,
          email: typeof data.authorSnapshot.email === "string" ? data.authorSnapshot.email : null
        }
      : null;

  return {
    id: docSnap.id,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : "",
    conversationId: typeof data.conversationId === "string" ? data.conversationId : "",
    threadId: typeof data.threadId === "string" ? data.threadId : null,
    threadRootMessageId: typeof data.threadRootMessageId === "string" ? data.threadRootMessageId : null,
    kind:
      data.kind === "attachment" ||
      data.kind === "assistant" ||
      data.kind === "reference" ||
      data.kind === "rich_text" ||
      data.kind === "system"
        ? data.kind
        : "text",
    type:
      data.type === "image" || data.type === "video" || data.type === "file" || data.type === "link"
        ? data.type
        : "text",
    body: typeof data.body === "string" ? data.body : typeof data.text === "string" ? data.text : "",
    text: typeof data.text === "string" ? data.text : typeof data.body === "string" ? data.body : "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    editedAt: data.editedAt ?? null,
    deletedAt: data.deletedAt ?? null,
    device: data.device === "mobile" ? "mobile" : "desktop",
    originDevice: data.originDevice === "mobile" ? "mobile" : data.device === "mobile" ? "mobile" : "desktop",
    status: data.status === "sending" || data.status === "failed" ? data.status : "sent",
    ingestState: data.ingestState === "sending" || data.ingestState === "failed" ? data.ingestState : "sent",
    clientId: typeof data.clientId === "string" ? data.clientId : docSnap.id,
    starred: Boolean(data.starred),
    author: typeof data.author === "string" ? data.author : authorSnapshot?.displayName ?? "Anonimo",
    authorId: typeof data.authorId === "string" ? data.authorId : "",
    authorSnapshot,
    reactions: mapReactions(data.reactions),
    reactionCounts: mapReactionCounts(data.reactionCounts),
    replyToId:
      typeof data.replyToId === "string"
        ? data.replyToId
        : typeof data.replyToMessageId === "string"
        ? data.replyToMessageId
        : null,
    replyToText:
      typeof data.replyToText === "string"
        ? data.replyToText
        : typeof data.replyPreview?.text === "string"
        ? data.replyPreview.text
        : null,
    replyToAuthor:
      typeof data.replyToAuthor === "string"
        ? data.replyToAuthor
        : typeof data.replyPreview?.authorSnapshot?.displayName === "string"
        ? data.replyPreview.authorSnapshot.displayName
        : null,
    replyToMessageId: typeof data.replyToMessageId === "string" ? data.replyToMessageId : null,
    replyPreview:
      data.replyPreview && typeof data.replyPreview === "object"
        ? {
            messageId:
              typeof data.replyPreview.messageId === "string"
                ? data.replyPreview.messageId
                : typeof data.replyToMessageId === "string"
                ? data.replyToMessageId
                : "",
            text: typeof data.replyPreview.text === "string" ? data.replyPreview.text : "",
            authorId: typeof data.replyPreview.authorId === "string" ? data.replyPreview.authorId : null,
            authorSnapshot:
              data.replyPreview.authorSnapshot && typeof data.replyPreview.authorSnapshot === "object"
                ? {
                    displayName:
                      typeof data.replyPreview.authorSnapshot.displayName === "string"
                        ? data.replyPreview.authorSnapshot.displayName
                        : "Anonimo",
                    avatarUrl:
                      typeof data.replyPreview.authorSnapshot.avatarUrl === "string"
                        ? data.replyPreview.authorSnapshot.avatarUrl
                        : null
                  }
                : null
          }
        : null,
    relatedEntityRefs: Array.isArray(data.relatedEntityRefs)
      ? data.relatedEntityRefs.filter(
          (entry): entry is Message["relatedEntityRefs"][number] =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof entry.entityType === "string" &&
            typeof entry.entityId === "string"
        )
      : [],
    attachmentIds: Array.isArray(data.attachmentIds)
      ? data.attachmentIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    fileURL:
      typeof data.fileURL === "string"
        ? data.fileURL
        : typeof attachmentPreview?.url === "string"
        ? attachmentPreview.url
        : null,
    fileName:
      typeof data.fileName === "string"
        ? data.fileName
        : typeof attachmentPreview?.name === "string"
        ? attachmentPreview.name
        : null,
    fileType:
      typeof data.fileType === "string"
        ? data.fileType
        : typeof attachmentPreview?.mimeType === "string"
        ? attachmentPreview.mimeType
        : null,
    storagePath:
      typeof data.storagePath === "string"
        ? data.storagePath
        : typeof attachmentPreview?.storagePath === "string"
        ? attachmentPreview.storagePath
        : null,
    size:
      typeof data.size === "number" ? data.size : typeof attachmentPreview?.size === "number" ? attachmentPreview.size : null,
    visibility: data.visibility === "deleted" ? "deleted" : "visible",
    source: data.source === "assistant" || data.source === "system" ? data.source : "user",
    contentVersion: typeof data.contentVersion === "number" ? data.contentVersion : 1
  };
};

const buildReplyPayload = (replyTo?: ReplyTarget | null) => {
  if (!replyTo) {
    return {
      replyToMessageId: null,
      replyPreview: null,
      replyToId: null,
      replyToText: null,
      replyToAuthor: null
    };
  }

  return {
    replyToMessageId: replyTo.id,
    replyPreview: {
      messageId: replyTo.id,
      text: replyTo.text,
      authorId: replyTo.authorId ?? null,
      authorSnapshot: replyTo.authorSnapshot ?? { displayName: replyTo.author, avatarUrl: null }
    },
    replyToId: replyTo.id,
    replyToText: replyTo.text,
    replyToAuthor: replyTo.author
  };
};

const buildBasePayload = (
  workspaceId: string,
  conversationId: string,
  authorId: string,
  authorSnapshot: Message["authorSnapshot"],
  clientId: string,
  status: MessageStatus
) => ({
  schemaVersion: 2,
  workspaceId,
  conversationId,
  threadId: null,
  threadRootMessageId: null,
  contentVersion: 1,
  authorId,
  authorSnapshot,
  author: authorSnapshot?.displayName ?? "Anonimo",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  editedAt: null,
  deletedAt: null,
  device: deviceType(),
  originDevice: deviceType(),
  status,
  ingestState: status,
  clientId,
  starred: false,
  reactions: {},
  reactionCounts: {},
  relatedEntityRefs: [],
  visibility: "visible",
  source: "user"
});

const buildTextPayload = (
  workspaceId: string,
  conversationId: string,
  value: string,
  authorId: string,
  authorSnapshot: Message["authorSnapshot"],
  clientId: string,
  replyTo?: ReplyTarget | null
) => {
  const text = normalizeText(value);
  if (!text) return null;
  validateTextLength(text, "El mensaje");

  return {
    ...buildBasePayload(workspaceId, conversationId, authorId, authorSnapshot, clientId, "sent"),
    kind: "text",
    type: detectLink(text) ? "link" : "text",
    body: text,
    text,
    attachmentIds: [],
    attachmentPreview: null,
    fileURL: null,
    fileName: null,
    fileType: null,
    storagePath: null,
    size: null,
    ...buildReplyPayload(replyTo)
  };
};

const buildFilePayload = (
  workspaceId: string,
  conversationId: string,
  attachment: AttachmentRecord,
  caption: string,
  authorId: string,
  authorSnapshot: Message["authorSnapshot"],
  clientId: string,
  replyTo?: ReplyTarget | null
) => {
  const normalizedCaption = normalizeText(caption);
  validateTextLength(normalizedCaption, "El texto adjunto");

  return {
    ...buildBasePayload(workspaceId, conversationId, authorId, authorSnapshot, clientId, "sent"),
    kind: "attachment",
    type: attachment.kind,
    body: normalizedCaption,
    text: normalizedCaption,
    attachmentIds: [attachment.id],
    attachmentPreview: attachment,
    fileURL: attachment.url,
    fileName: attachment.name,
    fileType: attachment.mimeType,
    storagePath: attachment.storagePath,
    size: attachment.size,
    ...buildReplyPayload(replyTo)
  };
};

export interface LatestMessagesPayload {
  messages: Message[];
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
  pageSize: number;
  changes: DocumentChange<DocumentData>[];
}

export const buildClientId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const subscribeToLatestMessages = (
  workspaceId: string,
  conversationId: string,
  cb: (payload: LatestMessagesPayload) => void,
  onError: (error: Error) => void
) => {
  const pageSize = resolvePageSize();
  const q = query(messagesCollection(workspaceId, conversationId), orderBy("createdAt", "desc"), limit(pageSize));

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
  workspaceId: string,
  conversationId: string,
  oldestDoc: QueryDocumentSnapshot<DocumentData> | null
) => {
  if (!oldestDoc) {
    return { docs: [] as QueryDocumentSnapshot<DocumentData>[], messages: [] as Message[], pageSize: resolvePageSize() };
  }

  const pageSize = resolvePageSize();
  const q = query(
    messagesCollection(workspaceId, conversationId),
    orderBy("createdAt", "desc"),
    startAfter(oldestDoc),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return {
    docs: snap.docs,
    messages: snap.docs.map(mapMessage).reverse(),
    pageSize
  };
};

export const fetchMessageById = async (workspaceId: string, conversationId: string, messageId: string) => {
  const snap = await getDoc(doc(messagesCollection(workspaceId, conversationId), messageId));
  if (!snap.exists()) return null;
  return mapMessage(snap as QueryDocumentSnapshot<DocumentData>);
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

export const sendTextMessage = async (
  workspaceId: string,
  conversationId: string,
  value: string,
  authorId: string,
  authorSnapshot: Message["authorSnapshot"],
  replyTo?: ReplyTarget | null,
  providedClientId?: string
) => {
  const clientId = providedClientId ?? buildClientId();
  const payload = buildTextPayload(
    workspaceId,
    conversationId,
    value,
    authorId,
    authorSnapshot,
    clientId,
    replyTo
  );
  if (!payload) return null;

  await setDoc(doc(messagesCollection(workspaceId, conversationId), clientId), payload, { merge: true });
  await setDoc(
    doc(db, "workspaces", workspaceId, "conversations", conversationId),
    { updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp() },
    { merge: true }
  );
  return clientId;
};

export const sendFileMessageWithProgress = async (
  workspaceId: string,
  conversationId: string,
  ownerId: string,
  file: File,
  caption: string,
  authorId: string,
  authorSnapshot: Message["authorSnapshot"],
  replyTo?: ReplyTarget | null,
  onProgress?: (value: number) => void,
  providedClientId?: string
) => {
  validateFile(file);

  const clientId = providedClientId ?? buildClientId();
  const messageId = clientId;
  const attachmentId = `attachment-${messageId}`;
  const storagePath = `workspaces/${workspaceId}/attachments/${messageId}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (!onProgress) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      () => resolve()
    );
  });

  const url = await getDownloadURL(storageRef);
  const attachment: AttachmentRecord = {
    id: attachmentId,
    workspaceId,
    ownerId,
    conversationId,
    messageId,
    kind: isImage(file) ? "image" : isVideo(file) ? "video" : "file",
    name: file.name,
    mimeType: file.type || null,
    url,
    storagePath,
    size: file.size,
    createdAt: null,
    status: "uploaded"
  };

  await setDoc(doc(attachmentsCollection(workspaceId), attachmentId), {
    ...attachment,
    createdAt: serverTimestamp()
  });

  await setDoc(
    doc(messagesCollection(workspaceId, conversationId), messageId),
    buildFilePayload(workspaceId, conversationId, attachment, caption, authorId, authorSnapshot, clientId, replyTo),
    { merge: true }
  );
  await setDoc(
    doc(db, "workspaces", workspaceId, "conversations", conversationId),
    { updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp() },
    { merge: true }
  );
  return messageId;
};

export const editMessageText = async (
  workspaceId: string,
  conversationId: string,
  messageId: string,
  nextText: string
) => {
  const normalized = normalizeText(nextText);
  if (!normalized) throw new Error("El mensaje editado no puede quedar vacio.");
  validateTextLength(normalized, "El mensaje");

  await updateDoc(doc(messagesCollection(workspaceId, conversationId), messageId), {
    body: normalized,
    text: normalized,
    editedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    contentVersion: 2
  });
};

export const toggleMessageReaction = async (
  workspaceId: string,
  conversationId: string,
  messageId: string,
  emoji: string,
  actorUid: string
) => {
  const messageRef = doc(messagesCollection(workspaceId, conversationId), messageId);
  const reactionRef = doc(
    db,
    "workspaces",
    workspaceId,
    "conversations",
    conversationId,
    "messages",
    messageId,
    "reactions",
    `${emoji}_${actorUid}`
  );

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(messageRef);
    if (!snap.exists()) throw new Error("No se encontro el mensaje para reaccionar.");

    const data = snap.data();
    const reactions = mapReactions(data.reactions);
    const counts = mapReactionCounts(data.reactionCounts);
    const list = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
    const hasReaction = list.includes(actorUid);
    const nextList = hasReaction ? list.filter((entry) => entry !== actorUid) : [...list, actorUid];

    if (nextList.length > 0) {
      reactions[emoji] = nextList;
      counts[emoji] = nextList.length;
    } else {
      delete reactions[emoji];
      delete counts[emoji];
    }

    if (hasReaction) {
      tx.delete(reactionRef);
    } else {
      tx.set(reactionRef, { actorUid, emoji, createdAt: serverTimestamp() });
    }

    tx.update(messageRef, {
      reactions,
      reactionCounts: counts,
      updatedAt: serverTimestamp()
    });
  });
};

export const toggleMessageStar = async (
  workspaceId: string,
  conversationId: string,
  messageId: string,
  starred: boolean
) => {
  await updateDoc(doc(messagesCollection(workspaceId, conversationId), messageId), {
    starred: !starred,
    updatedAt: serverTimestamp()
  });
};

export const deleteMessageAndAsset = async (
  workspaceId: string,
  conversationId: string,
  message: Message
) => {
  for (const attachmentId of message.attachmentIds) {
    const attachmentRef = doc(attachmentsCollection(workspaceId), attachmentId);
    const attachmentSnap = await getDoc(attachmentRef);
    if (!attachmentSnap.exists()) continue;

    const data = attachmentSnap.data();
    if (typeof data.storagePath === "string" && data.storagePath.length > 0) {
      try {
        await deleteObject(ref(storage, data.storagePath));
      } catch {
        // Si el archivo ya no existe, igual permitimos borrar el documento.
      }
    }

    await deleteDoc(attachmentRef);
  }

  await deleteDoc(doc(messagesCollection(workspaceId, conversationId), message.id));
};
