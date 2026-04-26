import { useCallback, useEffect, useRef, useState } from "react";
import { type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import {
  applyMessageChanges,
  deleteMessageAndAsset,
  fetchOlderMessages,
  sendFileMessageWithProgress,
  sendTextMessage,
  subscribeToLatestMessages,
  toggleMessageStar
} from "../lib/messages";
import { loadCachedMessages, saveCachedMessages } from "../lib/messageCache";
import { Message, ReplyTarget } from "../lib/types";
import { buildUploadId } from "../features/uploads/uploadProgress";

type FailedSend =
  | { kind: "text"; text: string; replyTo: ReplyTarget | null }
  | { kind: "file"; file: File; caption: string; replyTo: ReplyTarget | null };

export const useMessages = (uid: string | null, author: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [uploadsProgress, setUploadsProgress] = useState<Record<string, { name: string; progress: number }>>({});
  const [lastFailedSend, setLastFailedSend] = useState<FailedSend | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  const initialLoadedRef = useRef(false);

  useEffect(() => {
    if (!uid) return;

    initialLoadedRef.current = false;
    setError(null);
    setSendError(null);
    setOldestDoc(null);
    setReachedEnd(false);
    setFromCache(false);
    setHasPendingWrites(false);

    const cached = loadCachedMessages(uid);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }

    const unsub = subscribeToLatestMessages(
      uid,
      (payload) => {
        setFromCache(payload.fromCache);
        setHasPendingWrites(payload.hasPendingWrites);
        setOldestDoc(payload.lastVisibleDoc);

        if (!initialLoadedRef.current) {
          setMessages(payload.messages);
          setReachedEnd(payload.messages.length < payload.pageSize);
          initialLoadedRef.current = true;
          setLoading(false);
          saveCachedMessages(uid, payload.messages);
          return;
        }

        if (payload.changes.length > 0) {
          setMessages((prev) => {
            const next = applyMessageChanges(prev, payload.changes);
            saveCachedMessages(uid, next);
            return next;
          });
        } else if (payload.messages.length > 0) {
          // Recuperacion: si el primer snapshot fue vacio (cache) y el actual trae mensajes
          // pero docChanges() viene vacio, no nos quedamos con [].
          setMessages((prev) => {
            if (prev.length === 0) {
              saveCachedMessages(uid, payload.messages);
              return payload.messages;
            }
            return prev;
          });
          setReachedEnd(payload.messages.length < payload.pageSize);
        }

        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [uid]);

  const sendText = useCallback(
    async (text: string, replyTo: ReplyTarget | null = null) => {
      if (!uid) return false;

      setSending(true);
      setSendError(null);

      try {
        await sendTextMessage(uid, text, author, replyTo);
        setLastFailedSend(null);
        return true;
      } catch (sendTextError) {
        const message = sendTextError instanceof Error ? sendTextError.message : "No se pudo enviar el mensaje.";
        setError(message);
        setSendError(message);
        setLastFailedSend({ kind: "text", text, replyTo });
        return false;
      } finally {
        setSending(false);
      }
    },
    [author, uid]
  );

  const sendFile = useCallback(
    async (file: File, caption = "", replyTo: ReplyTarget | null = null) => {
      if (!uid) return false;

      const uploadId = buildUploadId();
      setSending(true);
      setSendError(null);
      setUploadsProgress((prev) => ({
        ...prev,
        [uploadId]: { name: file.name, progress: 0 }
      }));

      try {
        await sendFileMessageWithProgress(uid, file, caption, author, replyTo, (value) => {
          setUploadsProgress((prev) => ({
            ...prev,
            [uploadId]: { name: file.name, progress: value }
          }));
        });
        setLastFailedSend(null);
        return true;
      } catch (sendFileError) {
        const message = sendFileError instanceof Error ? sendFileError.message : "No se pudo enviar el archivo.";
        setError(message);
        setSendError(message);
        setLastFailedSend({ kind: "file", file, caption, replyTo });
        return false;
      } finally {
        setSending(false);
        setUploadsProgress((prev) => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
      }
    },
    [author, uid]
  );

  const retryLastFailedSend = useCallback(async () => {
    if (!lastFailedSend || sending) return false;

    if (lastFailedSend.kind === "text") {
      return sendText(lastFailedSend.text, lastFailedSend.replyTo);
    }

    return sendFile(lastFailedSend.file, lastFailedSend.caption, lastFailedSend.replyTo);
  }, [lastFailedSend, sendFile, sendText, sending]);

  const loadMore = async () => {
    if (!uid || !oldestDoc || loadingMore || reachedEnd) return;
    setLoadingMore(true);

    try {
      const older = await fetchOlderMessages(uid, oldestDoc);

      if (older.docs.length === 0) {
        setReachedEnd(true);
      } else {
        setOldestDoc(older.docs[older.docs.length - 1]);
        setReachedEnd(older.docs.length < older.pageSize);
        setMessages((prev) => {
          const merged = [...older.messages, ...prev];
          const unique = new Map(merged.map((msg) => [msg.id, msg]));
          return [...unique.values()].sort((a, b) => {
            const aSec = a.createdAt?.seconds ?? 0;
            const bSec = b.createdAt?.seconds ?? 0;
            if (aSec !== bSec) return aSec - bSec;
            const aNano = a.createdAt?.nanoseconds ?? 0;
            const bNano = b.createdAt?.nanoseconds ?? 0;
            return aNano - bNano;
          });
        });
      }
    } catch (loadMoreError) {
      setError(loadMoreError instanceof Error ? loadMoreError.message : "No se pudieron cargar mensajes anteriores.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleStar = async (messageId: string, starred: boolean) => {
    if (!uid) return;

    try {
      await toggleMessageStar(uid, messageId, starred);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No se pudo actualizar el favorito.");
    }
  };

  const deleteMessage = async (message: Message) => {
    if (!uid) return;

    try {
      await deleteMessageAndAsset(uid, message);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el mensaje.");
    }
  };

  const clearError = () => setError(null);
  const clearSendError = () => setSendError(null);

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
    sendText,
    sendFile,
    retryLastFailedSend,
    loadMore,
    toggleStar,
    deleteMessage,
    clearError,
    clearSendError
  };
};