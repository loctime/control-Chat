import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ChevronDown } from "lucide-react";
import { Message } from "../lib/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
  search: string;
  loading: boolean;
  onCopy: (text: string) => void;
  onDelete: (message: Message) => void;
  onToggleStar: (message: Message) => void;
  onReply: (message: Message) => void;
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
  onCopy,
  onDelete,
  onToggleStar,
  onReply,
  onLoadMore,
  loadingMore,
  hasMore,
  uploadsProgress
}: Props) => {
  const listRef = useRef<VirtuosoHandle | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const previousCount = useRef(0);

  const normalizedSearch = search.toLowerCase();
  const filtered = useMemo(
    () =>
      messages.filter(
        (msg) =>
          msg.text.toLowerCase().includes(normalizedSearch) ||
          (msg.fileName ?? "").toLowerCase().includes(normalizedSearch)
      ),
    [messages, normalizedSearch]
  );

  const scrollToBottom = () => {
    if (!filtered.length) return;
    listRef.current?.scrollToIndex({
      index: filtered.length - 1,
      align: "end",
      behavior: "smooth"
    });
  };

  const scrollToMessage = (messageId: string) => {
    const index = filtered.findIndex((msg) => msg.id === messageId);
    if (index === -1) return;

    listRef.current?.scrollToIndex({ index, align: "center", behavior: "smooth" });

    window.setTimeout(() => {
      const target = document.getElementById(`message-${messageId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      
      // Add highlight effect
      setHighlightedMessageId(messageId);
      window.setTimeout(() => setHighlightedMessageId(null), 2000);
    }, 150);
  };

  useEffect(() => {
    const hasNewMessages = filtered.length > previousCount.current;
    if (hasNewMessages && isAtBottom) {
      listRef.current?.scrollToIndex({ index: Math.max(filtered.length - 1, 0), behavior: "smooth" });
    }
    previousCount.current = filtered.length;
  }, [filtered.length, isAtBottom]);

  useEffect(() => {
    if (isAtBottom && Object.keys(uploadsProgress).length > 0) {
      listRef.current?.scrollToIndex({ index: Math.max(filtered.length - 1, 0), behavior: "smooth" });
    }
  }, [filtered.length, isAtBottom, uploadsProgress]);

  if (loading) {
    return <div className="empty-state">Cargando mensajes...</div>;
  }

  if (!filtered.length && Object.keys(uploadsProgress).length === 0) {
    return (
      <div className="empty-state">
        {search ? "Sin resultados en mensajes cargados." : "No hay mensajes. Escribi tu primera nota."}
        {search && hasMore ? <p className="empty-suggestion">Proba cargar mensajes anteriores.</p> : null}
      </div>
    );
  }

  return (
    <div className="message-list" id="chat-scroll">
      {hasMore ? (
        <button
          type="button"
          className="load-more load-more-floating"
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Cargando..." : "Cargar anteriores"}
        </button>
      ) : null}
      {!isAtBottom && filtered.length > 0 ? (
        <button
          type="button"
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          aria-label="Ir al final"
          title="Ir al final"
        >
          <ChevronDown size={20} />
        </button>
      ) : null}
      <Virtuoso
        ref={listRef}
        style={{ height: "100%" }}
        data={filtered}
        atBottomThreshold={80}
        atBottomStateChange={setIsAtBottom}
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
                onCopy={onCopy}
                onDelete={onDelete}
                onToggleStar={onToggleStar}
                onReply={onReply}
                onNavigateToMessage={scrollToMessage}
                isHighlighted={highlightedMessageId === message.id}
              />
            </div>
          );
        }}
      />
    </div>
  );
};
