import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { MessageBubble } from "./MessageBubble";
import { Message } from "../lib/types";

interface Props {
  messages: Message[];
  search: string;
  loading: boolean;
  currentUserId: string;
  onCopy: (text: string) => void;
  onDelete: (message: Message) => void;
  onToggleStar: (message: Message) => void;
  onReply: (message: Message) => void;
  onRetryMessage: (message: Message) => void;
  onEditMessage: (message: Message, nextText: string) => Promise<boolean>;
  onToggleReaction: (message: Message, emoji: string) => void;
  onEnsureMessageLoaded: (messageId: string) => Promise<boolean>;
  onLoadMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  uploadsProgress: Record<string, { name: string; progress: number }>;
}

const dateLabel = (seconds: number | undefined) => {
  if (!seconds) return "Ahora";
  return new Date(seconds * 1000).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
};

export const MessageList = ({
  messages,
  search,
  loading,
  currentUserId,
  onCopy,
  onDelete,
  onToggleStar,
  onReply,
  onRetryMessage,
  onEditMessage,
  onToggleReaction,
  onEnsureMessageLoaded,
  onLoadMore,
  loadingMore,
  hasMore,
  uploadsProgress
}: Props) => {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [replyJumpError, setReplyJumpError] = useState<string | null>(null);
  const previousCount = useRef(0);

  const normalizedSearch = search.toLowerCase();
  const filtered = useMemo(
    () =>
      messages.filter(
        (msg: Message) =>
          msg.text.toLowerCase().includes(normalizedSearch) ||
          (msg.fileName ?? "").toLowerCase().includes(normalizedSearch)
      ),
    [messages, normalizedSearch]
  );

  const scrollToBottom = () => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    setUnreadCount(0);
  };

  const scrollToMessage = async (messageId: string) => {
    setReplyJumpError(null);

    let exists = filtered.some((msg: Message) => msg.id === messageId);
    if (!exists) {
      const loaded = await onEnsureMessageLoaded(messageId);
      if (!loaded) {
        setReplyJumpError("No se encontro el mensaje citado.");
        return;
      }
    }

    const index = filtered.findIndex((msg: Message) => msg.id === messageId);
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({ index, behavior: 'smooth' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      setIsAtBottom(nearBottom);
    };

    onScroll();
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const hasNewMessages = filtered.length > previousCount.current;
    if (!hasNewMessages) {
      previousCount.current = filtered.length;
      return;
    }

    const newItems = filtered.length - previousCount.current;
    if (isAtBottom) {
      window.requestAnimationFrame(scrollToBottom);
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + newItems);
    }

    previousCount.current = filtered.length;
  }, [filtered.length, isAtBottom]);

  useEffect(() => {
    if (isAtBottom) setUnreadCount(0);
  }, [isAtBottom]);

  useEffect(() => {
    if (isAtBottom && Object.keys(uploadsProgress).length > 0) {
      window.requestAnimationFrame(scrollToBottom);
    }
  }, [filtered.length, isAtBottom, uploadsProgress]);

  if (loading) return <div className="empty-state">Cargando mensajes...</div>;

  if (!filtered.length && Object.keys(uploadsProgress).length === 0) {
    return (
      <div className="empty-state">
        {search ? "Sin resultados en mensajes cargados." : "No hay mensajes. Escribi tu primera nota."}
        {search && hasMore ? <p className="empty-suggestion">Proba cargar mensajes anteriores.</p> : null}
      </div>
    );
  }

  return (
    <div className="message-list">
      {hasMore ? (
        <div className="list-header">
          <button type="button" className="load-more" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Cargando..." : "Cargar anteriores"}
          </button>
        </div>
      ) : null}

      <Virtuoso
        ref={virtuosoRef}
        className="message-scroll"
        data={filtered}
        itemContent={(index: number, message: Message) => {
          const previous = index > 0 ? filtered[index - 1] : null;
          const currentDate = dateLabel(message.createdAt?.seconds);
          const previousDate = previous ? dateLabel(previous.createdAt?.seconds) : null;
          const showDate = currentDate !== previousDate;

          return (
            <div className="message-virtual-item">
              {showDate ? <p className="date-chip">{currentDate}</p> : null}
              <MessageBubble
                message={message}
                currentUserId={currentUserId}
                onCopy={onCopy}
                onDelete={onDelete}
                onToggleStar={onToggleStar}
                onReply={onReply}
                onRetry={() => onRetryMessage(message)}
                onEdit={(nextText) => onEditMessage(message, nextText)}
                onToggleReaction={(emoji) => onToggleReaction(message, emoji)}
                onNavigateToMessage={scrollToMessage}
                isHighlighted={highlightedMessageId === message.id}
              />
            </div>
          );
        }}
        components={{
          Footer: () => (
            <>
              {Object.entries(uploadsProgress).map(([id, item]) => (
                <div key={id} className="upload-item">
                  <p>{item.name}</p>
                  <div className="upload-track">
                    <span style={{ width: `${item.progress}%` }} />
                  </div>
                  <small>{item.progress}%</small>
                </div>
              ))}
            </>
          )
        }}
      />

      {!isAtBottom && unreadCount > 0 ? (
        <button type="button" className="unread-cta" onClick={scrollToBottom}>
          {unreadCount} nuevo{unreadCount > 1 ? "s" : ""} - Ir al final
        </button>
      ) : null}
    </div>
  );
};
