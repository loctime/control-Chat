import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import {
  applyMessageChanges,
  deleteMessage as deleteMessageDoc,
  fetchOlderMessages,
  MAX_TEXT_LENGTH,
  sendTextMessage,
  subscribeToLatestMessages,
  toggleMessageStar
} from "../lib/messages";
import { loadCachedMessages, saveCachedMessages } from "../lib/messageCache";
import {
  generateClientId,
  loadOutbox,
  outboxItemToMessage,
  saveOutbox,
  type OutboxItem
} from "../lib/outbox";
import { Message, ReplyTarget } from "../lib/types";

const detectDevice = (): "mobile" | "desktop" =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
    ? "mobile"
    : "desktop";

const toEpoch = (message: Message) => {
  const seconds = message.createdAt?.seconds ?? 0;
  const nanos = message.createdAt?.nanoseconds ?? 0;
  return seconds * 1_000_000_000 + nanos;
};

export const useMessages = (uid: string | null, author: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  const initialLoadedRef = useRef(false);
  const uidRef = useRef<string | null>(uid);
  const authorRef = useRef(author);

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    authorRef.current = author;
  }, [author]);

  const updateOutbox = useCallback(
    (currentUid: string, updater: (prev: OutboxItem[]) => OutboxItem[]) => {
      setOutbox((prev) => {
        const next = updater(prev);
        saveOutbox(currentUid, next);
        return next;
      });
    },
    []
  );

  const flushItem = useCallback(
    async (currentUid: string, item: OutboxItem) => {
      try {
        await sendTextMessage(currentUid, item.text, item.author, item.replyTo, item.clientId);
        // Cuando el snapshot devuelva el doc confirmado, lo removemos del outbox
        // mediante reconcileOutbox. No lo borramos aca para evitar el "salto" visual
        // entre item local y doc remoto.
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo enviar el mensaje.";
        if (uidRef.current === currentUid) {
          setSendError(msg);
        }
        updateOutbox(currentUid, (prev) =>
          prev.map((it) =>
            it.clientId === item.clientId ? { ...it, failed: true, errorMessage: msg } : it
          )
        );
      }
    },
    [updateOutbox]
  );

  useEffect(() => {
    if (!uid) {
      setOutbox([]);
      return;
    }

    const stored = loadOutbox(uid);
    setOutbox(stored);

    // Reintentar en background los items que no fallaron explicitamente.
    // Firestore deduplica por id, asi que setDoc es idempotente.
    stored
      .filter((item) => !item.failed)
      .forEach((item) => {
        void flushItem(uid, item);
      });
  }, [uid, flushItem]);

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

        const confirmed = (list: Message[]) => list.filter((m) => m.createdAt !== null);

        if (!initialLoadedRef.current) {
          setMessages(payload.messages);
          setReachedEnd(payload.messages.length < payload.pageSize);
          initialLoadedRef.current = true;
          setLoading(false);
          saveCachedMessages(uid, confirmed(payload.messages));
        } else if (payload.changes.length > 0) {
          setMessages((prev) => {
            const next = applyMessageChanges(prev, payload.changes);
            saveCachedMessages(uid, confirmed(next));
            return next;
          });
        } else if (payload.messages.length > 0) {
          // Recuperacion: si el primer snapshot fue vacio (cache) y el actual trae
          // mensajes pero docChanges() viene vacio, no nos quedamos con [].
          setMessages((prev) => {
            if (prev.length === 0) {
              saveCachedMessages(uid, confirmed(payload.messages));
              return payload.messages;
            }
            return prev;
          });
          setReachedEnd(payload.messages.length < payload.pageSize);
          setLoading(false);
        } else {
          setLoading(false);
        }

        // Reconciliar outbox: cualquier doc confirmado (createdAt !== null)
        // cuyo clientId coincida con un item del outbox, sale del outbox.
        const confirmedClientIds = new Set(
          payload.messages
            .filter((m) => m.createdAt !== null && m.clientId)
            .map((m) => m.clientId as string)
        );
        if (confirmedClientIds.size > 0) {
          updateOutbox(uid, (prev) => prev.filter((it) => !confirmedClientIds.has(it.clientId)));
        }
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [uid, updateOutbox]);

  const sendText = useCallback(
    (text: string, replyTo: ReplyTarget | null = null): boolean => {
      const currentUid = uidRef.current;
      if (!currentUid) return false;

      const trimmed = text.trim();
      if (!trimmed) return false;

      if (trimmed.length > MAX_TEXT_LENGTH) {
        setSendError(`El mensaje supera el maximo de ${MAX_TEXT_LENGTH} caracteres.`);
        return false;
      }

      setSendError(null);

      const item: OutboxItem = {
        clientId: generateClientId(),
        text: trimmed,
        author: authorRef.current,
        replyTo: replyTo ? { ...replyTo } : null,
        createdAtMs: Date.now(),
        device: detectDevice()
      };

      updateOutbox(currentUid, (prev) => [...prev, item]);
      void flushItem(currentUid, item);

      return true;
    },
    [flushItem, updateOutbox]
  );

  const retryFailedSends = useCallback(() => {
    const currentUid = uidRef.current;
    if (!currentUid) return false;

    const failed = outbox.filter((it) => it.failed);
    if (failed.length === 0) return false;

    setSendError(null);
    updateOutbox(currentUid, (prev) =>
      prev.map((it) => (it.failed ? { ...it, failed: false, errorMessage: undefined } : it))
    );

    failed.forEach((item) => {
      void flushItem(currentUid, { ...item, failed: false, errorMessage: undefined });
    });
    return true;
  }, [outbox, flushItem, updateOutbox]);

  const retrySingle = useCallback(
    (clientId: string) => {
      const currentUid = uidRef.current;
      if (!currentUid) return;

      const target = outbox.find((it) => it.clientId === clientId);
      if (!target) return;

      updateOutbox(currentUid, (prev) =>
        prev.map((it) =>
          it.clientId === clientId ? { ...it, failed: false, errorMessage: undefined } : it
        )
      );
      void flushItem(currentUid, { ...target, failed: false, errorMessage: undefined });
    },
    [outbox, flushItem, updateOutbox]
  );

  const discardFailed = useCallback(
    (clientId: string) => {
      const currentUid = uidRef.current;
      if (!currentUid) return;
      updateOutbox(currentUid, (prev) => prev.filter((it) => it.clientId !== clientId));
    },
    [updateOutbox]
  );

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
          return [...unique.values()].sort((a, b) => toEpoch(a) - toEpoch(b));
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
    const currentUid = uidRef.current;
    if (!currentUid) return;

    // Si el mensaje todavia esta en el outbox (no llego a confirmarse),
    // alcanza con sacarlo de la cola local.
    if (message.clientId && outbox.some((it) => it.clientId === message.clientId)) {
      updateOutbox(currentUid, (prev) => prev.filter((it) => it.clientId !== message.clientId));
      return;
    }

    try {
      await deleteMessageDoc(currentUid, message.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el mensaje.");
    }
  };

  const clearError = () => setError(null);
  const clearSendError = () => setSendError(null);

  const visibleMessages = useMemo(() => {
    // Mostramos solo docs ya confirmados por el server (con createdAt resuelto).
    // Los pendientes locales se muestran via outbox para asegurar timestamp y orden
    // estables incluso antes de que Firestore resuelva serverTimestamp().
    const confirmedById = new Map<string, Message>();
    const confirmedClientIds = new Set<string>();
    for (const m of messages) {
      if (m.createdAt !== null) {
        confirmedById.set(m.id, m);
        if (m.clientId) confirmedClientIds.add(m.clientId);
      }
    }

    const pending = outbox
      .filter((it) => !confirmedClientIds.has(it.clientId) && !confirmedById.has(it.clientId))
      .map(outboxItemToMessage);

    return [...confirmedById.values(), ...pending].sort((a, b) => toEpoch(a) - toEpoch(b));
  }, [messages, outbox]);

  const outboxHasFailed = outbox.some((it) => it.failed);
  const outboxHasPending = outbox.length > 0;

  return {
    messages: visibleMessages,
    loading,
    error,
    sendError,
    hasMore: Boolean(oldestDoc) && !reachedEnd,
    loadingMore,
    fromCache,
    hasPendingWrites: hasPendingWrites || outboxHasPending,
    hasFailedSends: outboxHasFailed,
    sendText,
    retryLastFailedSend: retryFailedSends,
    retryMessage: retrySingle,
    discardFailedMessage: discardFailed,
    loadMore,
    toggleStar,
    deleteMessage,
    clearError,
    clearSendError
  };
};
