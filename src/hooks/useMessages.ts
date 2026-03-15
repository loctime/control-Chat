import { useCallback, useEffect, useRef, useState } from "react";
import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import {
  applyMessageChanges,
  buildClientId,
  deleteMessageAndAsset,
  editMessageText,
  fetchMessageById,
  fetchOlderMessages,
  sendFileMessageWithProgress,
  sendTextMessage,
  subscribeToLatestMessages,
  toggleMessageReaction,
  toggleMessageStar,
  type LatestMessagesPayload
} from "../lib/messages";
import { AuthorSnapshot, Message, ReplyTarget } from "../lib/types";

type FailedSend =
  | { kind: "text"; messageId: string; text: string; replyTo: ReplyTarget | null }
  | { kind: "file"; messageId: string; file: File; caption: string; replyTo: ReplyTarget | null };

const toEpoch = (message: Message) => {
  const seconds = message.createdAt?.seconds ?? 0;
  const nanos = message.createdAt?.nanoseconds ?? 0;
  return seconds * 1_000_000_000 + nanos;
};

const mergeById = (base: Message[], incoming: Message[]) => {
  const map = new Map(base.map((msg) => [msg.id, msg]));
  for (const next of incoming) map.set(next.id, next);
  return [...map.values()].sort((a, b) => toEpoch(a) - toEpoch(b));
};

const detectFileMessageType = (file: File): "image" | "video" | "file" => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

export const useMessages = (
  uid: string | null,
  workspaceId: string | null,
  conversationId: string | null,
  authorId: string,
  authorSnapshot: AuthorSnapshot
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [uploadsProgress, setUploadsProgress] = useState<Record<string, { name: string; progress: number }>>({});
  const [failedSends, setFailedSends] = useState<Record<string, FailedSend>>({});
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  const initialLoadedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const mergeSnapshotPayload = useCallback((payload: LatestMessagesPayload) => {
    setMessages((prev) => {
      const pendingLocals = prev.filter(
        (msg) =>
          (msg.status === "sending" || msg.status === "failed") &&
          !payload.messages.some((incoming) => incoming.id === msg.id)
      );
      return [...payload.messages, ...pendingLocals].sort((a, b) => toEpoch(a) - toEpoch(b));
    });
  }, []);

  useEffect(() => {
    if (!workspaceId || !conversationId) return;

    initialLoadedRef.current = false;
    setMessages([]);
    setLoading(true);
    setError(null);
    setSendError(null);
    setOldestDoc(null);
    setReachedEnd(false);
    setFailedSends({});
    setFromCache(false);
    setHasPendingWrites(false);

    const unsub = subscribeToLatestMessages(
      workspaceId,
      conversationId,
      (payload) => {
        setFromCache(payload.fromCache);
        setHasPendingWrites(payload.hasPendingWrites);
        setOldestDoc(payload.lastVisibleDoc);

        if (!initialLoadedRef.current) {
          mergeSnapshotPayload(payload);
          setReachedEnd(payload.messages.length < payload.pageSize);
          initialLoadedRef.current = true;
          setLoading(false);
          return;
        }

        if (payload.changes.length > 0) {
          setMessages((prev) => applyMessageChanges(prev, payload.changes));
        } else if (payload.messages.length > 0) {
          mergeSnapshotPayload(payload);
          setReachedEnd(payload.messages.length < payload.pageSize);
        }

        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [workspaceId, conversationId, mergeSnapshotPayload]);

  const setLocalStatus = useCallback((messageId: string, status: Message["status"]) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, status } : msg)));
  }, []);

  const insertOptimisticText = useCallback(
    (messageId: string, text: string, replyTo: ReplyTarget | null) => {
      const optimisticMessage: Message = {
        id: messageId,
        workspaceId: workspaceId ?? "",
        conversationId: conversationId ?? "",
        threadId: null,
        threadRootMessageId: null,
        kind: "text",
        type: /^https?:\/\/.+/i.test(text.trim()) ? "link" : "text",
        body: text,
        text,
        fileURL: null,
        fileName: null,
        fileType: null,
        storagePath: null,
        size: null,
        createdAt: Timestamp.now(),
        updatedAt: null,
        editedAt: null,
        deletedAt: null,
        device: window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop",
        originDevice: window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop",
        status: "sending",
        ingestState: "sending",
        clientId: messageId,
        starred: false,
        author: authorSnapshot.displayName,
        authorId,
        authorSnapshot,
        reactions: {},
        reactionCounts: {},
        replyToId: replyTo?.id ?? null,
        replyToText: replyTo?.text ?? null,
        replyToAuthor: replyTo?.author ?? null,
        replyToMessageId: replyTo?.id ?? null,
        replyPreview: replyTo
          ? {
              messageId: replyTo.id,
              text: replyTo.text,
              authorId: replyTo.authorId ?? null,
              authorSnapshot: replyTo.authorSnapshot ?? { displayName: replyTo.author, avatarUrl: null }
            }
          : null,
        relatedEntityRefs: [],
        attachmentIds: [],
        visibility: "visible",
        source: "user",
        contentVersion: 1
      };

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === messageId);
        if (exists) {
          return prev.map((msg) => (msg.id === messageId ? { ...msg, text, body: text, status: "sending" } : msg));
        }
        return mergeById(prev, [optimisticMessage]);
      });
    },
    [authorId, authorSnapshot, conversationId, workspaceId]
  );

  const insertOptimisticFile = useCallback(
    (messageId: string, file: File, caption: string, replyTo: ReplyTarget | null) => {
      const optimisticMessage: Message = {
        id: messageId,
        workspaceId: workspaceId ?? "",
        conversationId: conversationId ?? "",
        threadId: null,
        threadRootMessageId: null,
        kind: "attachment",
        type: detectFileMessageType(file),
        body: caption,
        text: caption,
        fileURL: "",
        fileName: file.name,
        fileType: file.type || null,
        storagePath: "",
        size: file.size,
        createdAt: Timestamp.now(),
        updatedAt: null,
        editedAt: null,
        deletedAt: null,
        device: window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop",
        originDevice: window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop",
        status: "sending",
        ingestState: "sending",
        clientId: messageId,
        starred: false,
        author: authorSnapshot.displayName,
        authorId,
        authorSnapshot,
        reactions: {},
        reactionCounts: {},
        replyToId: replyTo?.id ?? null,
        replyToText: replyTo?.text ?? null,
        replyToAuthor: replyTo?.author ?? null,
        replyToMessageId: replyTo?.id ?? null,
        replyPreview: replyTo
          ? {
              messageId: replyTo.id,
              text: replyTo.text,
              authorId: replyTo.authorId ?? null,
              authorSnapshot: replyTo.authorSnapshot ?? { displayName: replyTo.author, avatarUrl: null }
            }
          : null,
        relatedEntityRefs: [],
        attachmentIds: [],
        visibility: "visible",
        source: "user",
        contentVersion: 1
      };

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === messageId);
        if (exists) {
          return prev.map((msg) => (msg.id === messageId ? { ...msg, text: caption, body: caption, status: "sending" } : msg));
        }
        return mergeById(prev, [optimisticMessage]);
      });
    },
    [authorId, authorSnapshot, conversationId, workspaceId]
  );

  const sendText = useCallback(
    async (text: string, replyTo: ReplyTarget | null = null, providedMessageId?: string) => {
      if (!workspaceId || !conversationId) return false;
      const messageId = providedMessageId ?? buildClientId();

      setSending(true);
      setSendError(null);
      insertOptimisticText(messageId, text, replyTo);

      try {
        await sendTextMessage(workspaceId, conversationId, text, authorId, authorSnapshot, replyTo, messageId);
        setFailedSends((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
        setLocalStatus(messageId, "sent");
        return true;
      } catch (sendTextError) {
        const message = sendTextError instanceof Error ? sendTextError.message : "No se pudo enviar el mensaje.";
        setError(message);
        setSendError(message);
        setLocalStatus(messageId, "failed");
        setFailedSends((prev) => ({
          ...prev,
          [messageId]: { kind: "text", messageId, text, replyTo }
        }));
        return false;
      } finally {
        setSending(false);
      }
    },
    [authorId, authorSnapshot, conversationId, insertOptimisticText, setLocalStatus, workspaceId]
  );

  const sendFile = useCallback(
    async (file: File, caption = "", replyTo: ReplyTarget | null = null, providedMessageId?: string) => {
      if (!uid || !workspaceId || !conversationId) return false;
      const messageId = providedMessageId ?? buildClientId();

      setSending(true);
      setSendError(null);
      insertOptimisticFile(messageId, file, caption, replyTo);
      setUploadsProgress((prev) => ({
        ...prev,
        [messageId]: { name: file.name, progress: 0 }
      }));

      try {
        await sendFileMessageWithProgress(
          workspaceId,
          conversationId,
          uid,
          file,
          caption,
          authorId,
          authorSnapshot,
          replyTo,
          (value) => {
            setUploadsProgress((prev) => ({
              ...prev,
              [messageId]: { name: file.name, progress: value }
            }));
          },
          messageId
        );
        setFailedSends((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
        setLocalStatus(messageId, "sent");
        return true;
      } catch (sendFileError) {
        const message = sendFileError instanceof Error ? sendFileError.message : "No se pudo enviar el archivo.";
        setError(message);
        setSendError(message);
        setLocalStatus(messageId, "failed");
        setFailedSends((prev) => ({
          ...prev,
          [messageId]: { kind: "file", messageId, file, caption, replyTo }
        }));
        return false;
      } finally {
        setSending(false);
        setUploadsProgress((prev) => {
          const next = { ...prev };
          delete next[messageId];
          return next;
        });
      }
    },
    [authorId, authorSnapshot, conversationId, insertOptimisticFile, setLocalStatus, uid, workspaceId]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const failed = failedSends[messageId];
      if (!failed || sending) return false;
      if (failed.kind === "text") return sendText(failed.text, failed.replyTo, failed.messageId);
      return sendFile(failed.file, failed.caption, failed.replyTo, failed.messageId);
    },
    [failedSends, sendFile, sendText, sending]
  );

  const retryLastFailedSend = useCallback(async () => {
    const failedEntries = Object.values(failedSends);
    const latest = failedEntries.length > 0 ? failedEntries[failedEntries.length - 1] : null;
    if (!latest) return false;
    return retryMessage(latest.messageId);
  }, [failedSends, retryMessage]);

  const loadMore = async () => {
    if (!workspaceId || !conversationId || !oldestDoc || loadingMore || reachedEnd) return;
    setLoadingMore(true);

    try {
      const older = await fetchOlderMessages(workspaceId, conversationId, oldestDoc);
      if (older.docs.length === 0) {
        setReachedEnd(true);
      } else {
        setOldestDoc(older.docs[older.docs.length - 1]);
        setReachedEnd(older.docs.length < older.pageSize);
        setMessages((prev) => mergeById(prev, older.messages));
      }
    } catch (loadMoreError) {
      setError(loadMoreError instanceof Error ? loadMoreError.message : "No se pudieron cargar mensajes anteriores.");
    } finally {
      setLoadingMore(false);
    }
  };

  const ensureMessageLoaded = useCallback(
    async (messageId: string) => {
      if (!workspaceId || !conversationId) return false;
      if (messagesRef.current.some((msg) => msg.id === messageId)) return true;

      const direct = await fetchMessageById(workspaceId, conversationId, messageId);
      if (direct) {
        setMessages((prev) => mergeById(prev, [direct]));
        return true;
      }

      let cursor = oldestDoc;
      let done = reachedEnd;

      while (cursor && !done) {
        const older = await fetchOlderMessages(workspaceId, conversationId, cursor);
        if (older.docs.length === 0) {
          done = true;
          setReachedEnd(true);
          break;
        }

        const olderLastDoc = older.docs[older.docs.length - 1];
        cursor = olderLastDoc;
        setOldestDoc(olderLastDoc);
        setReachedEnd(older.docs.length < older.pageSize);
        setMessages((prev) => mergeById(prev, older.messages));

        if (older.messages.some((msg) => msg.id === messageId)) return true;
        if (older.docs.length < older.pageSize) {
          done = true;
          setReachedEnd(true);
        }
      }

      return false;
    },
    [workspaceId, conversationId, oldestDoc, reachedEnd]
  );

  const toggleStar = async (messageId: string, starred: boolean) => {
    if (!workspaceId || !conversationId) return;
    try {
      await toggleMessageStar(workspaceId, conversationId, messageId, starred);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No se pudo actualizar el favorito.");
    }
  };

  const editMessage = async (messageId: string, nextText: string) => {
    if (!workspaceId || !conversationId) return false;
    try {
      await editMessageText(workspaceId, conversationId, messageId, nextText);
      return true;
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "No se pudo editar el mensaje.");
      return false;
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!workspaceId || !conversationId || !uid) return;
    try {
      await toggleMessageReaction(workspaceId, conversationId, messageId, emoji, uid);
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : "No se pudo reaccionar al mensaje.");
    }
  };

  const deleteMessage = async (message: Message) => {
    if (!workspaceId || !conversationId) return;
    try {
      await deleteMessageAndAsset(workspaceId, conversationId, message);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el mensaje.");
    }
  };

  return {
    messages,
    loading,
    error,
    sending,
    sendError,
    hasMore: Boolean(oldestDoc) && !reachedEnd,
    loadingMore,
    uploadsProgress,
    fromCache,
    hasPendingWrites,
    failedMessageIds: new Set(Object.keys(failedSends)),
    sendText,
    sendFile,
    retryMessage,
    retryLastFailedSend,
    loadMore,
    ensureMessageLoaded,
    toggleStar,
    editMessage,
    toggleReaction,
    deleteMessage,
    clearError: () => setError(null),
    clearSendError: () => setSendError(null)
  };
};
