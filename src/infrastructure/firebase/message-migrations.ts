import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { buildAuthorSnapshot } from "./workspace";
import { legacyAppPath } from "./paths";

const LEGACY_MESSAGES_MIGRATION_VERSION = 2;
const MIGRATION_BATCH_SIZE = 100;

const userDoc = (uid: string) => doc(db, "users", uid);
const legacyMessagesCollection = (uid: string) => collection(db, ...legacyAppPath, "users", uid, "messages");
const workspaceAttachmentsCollection = (workspaceId: string) =>
  collection(db, "workspaces", workspaceId, "attachments");
const conversationMessagesCollection = (workspaceId: string, conversationId: string) =>
  collection(db, "workspaces", workspaceId, "conversations", conversationId, "messages");

type MigrationCursor = {
  createdAt: unknown;
  messageId: string;
} | null;

const readCursor = (value: unknown): MigrationCursor => {
  if (!value || typeof value !== "object") return null;
  const cursor = value as Record<string, unknown>;
  return typeof cursor.messageId === "string" && cursor.messageId.length > 0
    ? { createdAt: cursor.createdAt ?? null, messageId: cursor.messageId }
    : null;
};

const buildLegacyBatchQuery = (uid: string, cursor: MigrationCursor) => {
  const base = [
    orderBy("createdAt", "asc"),
    orderBy(documentId(), "asc")
  ] as const;

  return cursor
    ? query(
        legacyMessagesCollection(uid),
        ...base,
        startAfter(cursor.createdAt, cursor.messageId),
        limit(MIGRATION_BATCH_SIZE)
      )
    : query(legacyMessagesCollection(uid), ...base, limit(MIGRATION_BATCH_SIZE));
};

const buildAttachmentIds = (legacyMessageId: string, data: Record<string, unknown>) =>
  typeof data.fileURL === "string" && typeof data.fileName === "string" ? [`legacy-${legacyMessageId}`] : [];

const migrateLegacyMessage = async (
  uid: string,
  workspaceId: string,
  conversationId: string,
  author: ReturnType<typeof buildAuthorSnapshot>,
  legacyMessageId: string,
  data: Record<string, unknown>
) => {
  const attachmentIds = buildAttachmentIds(legacyMessageId, data);

  if (attachmentIds.length > 0) {
    await setDoc(
      doc(workspaceAttachmentsCollection(workspaceId), attachmentIds[0]),
      {
        workspaceId,
        ownerId: uid,
        conversationId,
        messageId: legacyMessageId,
        kind: data.type === "image" || data.type === "video" ? data.type : "file",
        name: data.fileName,
        mimeType: data.fileType ?? null,
        url: data.fileURL,
        storagePath: data.storagePath ?? "",
        size: data.size ?? 0,
        status: "uploaded",
        createdAt: data.createdAt ?? serverTimestamp()
      },
      { merge: true }
    );
  }

  await setDoc(
    doc(conversationMessagesCollection(workspaceId, conversationId), legacyMessageId),
    {
      schemaVersion: 2,
      workspaceId,
      conversationId,
      threadId: null,
      threadRootMessageId: null,
      kind: data.type === "image" || data.type === "video" || data.type === "file" ? "attachment" : "text",
      type: data.type ?? "text",
      body: data.text ?? "",
      text: data.text ?? "",
      contentVersion: 1,
      authorId: uid,
      authorSnapshot: author,
      author: author.displayName,
      replyToMessageId: data.replyToId ?? null,
      replyPreview:
        typeof data.replyToId === "string"
          ? {
              messageId: data.replyToId,
              text: data.replyToText ?? "",
              authorId: uid,
              authorSnapshot: { displayName: data.replyToAuthor ?? author.displayName, avatarUrl: author.avatarUrl }
            }
          : null,
      replyToId: data.replyToId ?? null,
      replyToText: data.replyToText ?? null,
      replyToAuthor: data.replyToAuthor ?? null,
      relatedEntityRefs: [],
      attachmentIds,
      fileURL: data.fileURL ?? null,
      fileName: data.fileName ?? null,
      fileType: data.fileType ?? null,
      storagePath: data.storagePath ?? null,
      size: data.size ?? null,
      createdAt: data.createdAt ?? serverTimestamp(),
      updatedAt: data.updatedAt ?? data.createdAt ?? serverTimestamp(),
      editedAt: data.editedAt ?? null,
      deletedAt: data.deletedAt ?? null,
      device: data.device ?? "desktop",
      originDevice: data.device ?? "desktop",
      status: data.status ?? "sent",
      ingestState: data.status ?? "sent",
      clientId: data.clientId ?? legacyMessageId,
      starred: Boolean(data.starred),
      reactions: data.reactions ?? {},
      reactionCounts: data.reactionCounts ?? {},
      visibility: data.deletedAt ? "deleted" : "visible",
      source: "user"
    },
    { merge: true }
  );
};

export const migrateLegacyMessagesToConversation = async (
  uid: string,
  workspaceId: string,
  conversationId: string,
  author: ReturnType<typeof buildAuthorSnapshot>
) => {
  const userRef = userDoc(uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data() as Record<string, unknown> | undefined;
  const migrationState =
    userData?.migrationStatus && typeof userData.migrationStatus === "object"
      ? (userData.migrationStatus as Record<string, unknown>).legacyMessages
      : null;
  const startedAt =
    migrationState && typeof migrationState === "object" ? (migrationState as Record<string, unknown>).startedAt : null;
  let processedCount =
    migrationState && typeof migrationState === "object" && typeof (migrationState as Record<string, unknown>).processedCount === "number"
      ? ((migrationState as Record<string, unknown>).processedCount as number)
      : 0;
  let cursor =
    migrationState && typeof migrationState === "object"
      ? readCursor((migrationState as Record<string, unknown>).cursor)
      : null;

  if (typeof userData?.migrationVersion === "number" && userData.migrationVersion >= LEGACY_MESSAGES_MIGRATION_VERSION) {
    return { migrated: false, processedCount, completed: true };
  }

  await setDoc(
    userRef,
    {
      migrationStatus: {
        legacyMessages: {
          version: LEGACY_MESSAGES_MIGRATION_VERSION,
          status: "running",
          startedAt: startedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          processedCount,
          cursor
        }
      }
    },
    { merge: true }
  );

  while (true) {
    const legacyBatch = await getDocs(buildLegacyBatchQuery(uid, cursor));
    if (legacyBatch.empty) break;

    await Promise.all(
      legacyBatch.docs.map(async (legacyDoc) => {
        await migrateLegacyMessage(
          uid,
          workspaceId,
          conversationId,
          author,
          legacyDoc.id,
          legacyDoc.data() as Record<string, unknown>
        );
      })
    );

    processedCount += legacyBatch.docs.length;
    const lastLegacyDoc = legacyBatch.docs[legacyBatch.docs.length - 1];
    const lastLegacyData = lastLegacyDoc.data() as Record<string, unknown>;
    cursor = {
      createdAt: lastLegacyData.createdAt ?? null,
      messageId: lastLegacyDoc.id
    };

    await setDoc(
      userRef,
      {
        migrationStatus: {
          legacyMessages: {
            version: LEGACY_MESSAGES_MIGRATION_VERSION,
            status: "running",
            startedAt: startedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
            processedCount,
            cursor,
            lastLegacyMessageId: lastLegacyDoc.id
          }
        }
      },
      { merge: true }
    );
  }

  await setDoc(
    userRef,
    {
      migrationVersion: LEGACY_MESSAGES_MIGRATION_VERSION,
      migrationStatus: {
        legacyMessages: {
          version: LEGACY_MESSAGES_MIGRATION_VERSION,
          status: "completed",
          startedAt: startedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          processedCount,
          cursor: null,
          lastLegacyMessageId: cursor?.messageId ?? null
        }
      }
    },
    { merge: true }
  );

  return { migrated: processedCount > 0, processedCount, completed: true };
};
