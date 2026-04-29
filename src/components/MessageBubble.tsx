import { memo, useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import { AlertCircle, Clock } from "lucide-react";
import { Message } from "../lib/types";
import { MessageContextMenu } from "../features/message-actions/MessageContextMenu";
import { MessageContent } from "../features/message-renderers/MessageContent";
import { MessageActions } from "./MessageActions";
import { MessageReplyQuote } from "./MessageReplyQuote";

const formatHour = (seconds: number | undefined) => {
  if (!seconds) return "";
  return new Date(seconds * 1000).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

interface Props {
  message: Message;
  onCopy: (text: string) => void;
  onDelete: (message: Message) => void;
  onToggleStar: (message: Message) => void;
  onReply: (message: Message) => void;
  onNavigateToMessage: (messageId: string) => void;
  isHighlighted?: boolean;
}

const MessageBubbleBase = ({ message, onCopy, onDelete, onToggleStar, onReply, onNavigateToMessage, isHighlighted = false }: Props) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const time = formatHour(message.createdAt?.seconds);

  const canCopy = Boolean(message.text);

  const closeMenu = () => setMenuPos(null);

  const openMenu = (x: number, y: number, anchor: HTMLElement | null) => {
    setMenuAnchor(anchor);
    setMenuPos({ x, y });
  };

  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY, event.currentTarget);
  };

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    const timer = window.setTimeout(
      () => openMenu(touch.clientX, touch.clientY, event.currentTarget),
      420
    );

    const clear = () => {
      window.clearTimeout(timer);
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
    };

    window.addEventListener("touchend", clear);
    window.addEventListener("touchcancel", clear);
  };

  const messageTypeClass = useMemo(() => {
    let className = `bubble bubble-${message.type}`;
    if (isHighlighted) className += " bubble-highlighted";
    if (message.failed) className += " bubble-failed";
    else if (message.pending) className += " bubble-pending";
    return className;
  }, [message.type, isHighlighted, message.pending, message.failed]);

  return (
    <article
      id={`message-${message.id}`}
      className={messageTypeClass}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
    >
      {message.replyToId && message.replyToAuthor && message.replyToText ? (
        <MessageReplyQuote
          author={message.replyToAuthor}
          text={message.replyToText}
          onClick={() => message.replyToId && onNavigateToMessage(message.replyToId)}
        />
      ) : null}

      <div className="bubble-content-wrapper">
        <MessageContent message={message} />
        {message.text && (
          <MessageActions
            text={message.text}
            onReply={() => onReply(message)}
          />
        )}
      </div>

      <footer className="bubble-meta">
        {message.starred ? <span className="star">*</span> : null}
        <span>{message.device === "mobile" ? "Movil" : "PC"}</span>
        <span>
          {message.failed ? "Error" : message.pending ? "Enviando..." : time}
        </span>
        {message.failed ? (
          <AlertCircle size={12} className="failed-icon" aria-label="No se pudo enviar" />
        ) : message.pending ? (
          <Clock size={12} className="pending-icon" aria-label="Sincronizando" />
        ) : null}
      </footer>

      {menuPos ? (
        <MessageContextMenu
          x={menuPos.x}
          y={menuPos.y}
          canCopy={canCopy}
          isStarred={message.starred}
          returnFocusTo={menuAnchor}
          onCopy={() => {
            if (message.text) onCopy(message.text);
            closeMenu();
          }}
          onToggleStar={() => {
            onToggleStar(message);
            closeMenu();
          }}
          onDelete={() => {
            onDelete(message);
            closeMenu();
          }}
          onClose={closeMenu}
        />
      ) : null}
    </article>
  );
};

export const MessageBubble = memo(MessageBubbleBase);
