import { memo, useEffect, useMemo, useState, type MouseEvent, type TouchEvent } from "react";
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
  currentUserId: string;
  onCopy: (text: string) => void;
  onDelete: (message: Message) => void;
  onToggleStar: (message: Message) => void;
  onReply: (message: Message) => void;
  onRetry: () => void;
  onEdit: (nextText: string) => Promise<boolean>;
  onToggleReaction: (emoji: string) => void;
  onNavigateToMessage: (messageId: string) => void;
  isHighlighted?: boolean;
}

const REACTION_CHOICES = ["👍", "💡", "🧠"];

const MessageBubbleBase = ({
  message,
  currentUserId,
  onCopy,
  onDelete,
  onToggleStar,
  onReply,
  onRetry,
  onEdit,
  onToggleReaction,
  onNavigateToMessage,
  isHighlighted = false
}: Props) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message.text);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const time = formatHour(message.createdAt?.seconds);

  const canCopy = Boolean(message.text);
  const canOpen = Boolean(message.fileURL);
  const canRetry = message.status === "failed";
  const canEdit = message.type === "text" || message.type === "link" || Boolean(message.text);

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
    const timer = window.setTimeout(() => openMenu(touch.clientX, touch.clientY, event.currentTarget), 420);

    const clear = () => {
      window.clearTimeout(timer);
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
    };

    window.addEventListener("touchend", clear);
    window.addEventListener("touchcancel", clear);
  };

  const messageTypeClass = useMemo(() => {
    const baseClass = `bubble bubble-${message.type}`;
    return isHighlighted ? `${baseClass} bubble-highlighted` : baseClass;
  }, [message.type, isHighlighted]);

  const statusLabel = message.status === "failed" ? "Fallo" : message.status === "sending" ? "Enviando" : "Enviado";

  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0);

  useEffect(() => {
    setDraftText(message.text);
  }, [message.text]);

  const saveEdit = async () => {
    if (isSavingEdit) return;
    setIsSavingEdit(true);
    void onEdit(draftText).then((ok) => {
      setIsSavingEdit(false);
      if (ok) {
        setIsEditing(false);
      }
    });
  };

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
        {isEditing ? (
          <div className="bubble-editor">
            <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} rows={3} />
            <div className="bubble-editor-actions">
              <button type="button" className="ghost-btn" onClick={() => setIsEditing(false)} disabled={isSavingEdit}>
                Cancelar
              </button>
              <button type="button" className="ghost-btn" onClick={() => void saveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? "Guardando" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          <MessageContent message={message} />
        )}
        <MessageActions text={message.text} onReply={() => onReply(message)} />
      </div>

      <div className="reaction-row">
        {REACTION_CHOICES.map((emoji) => {
          const users = message.reactions?.[emoji] ?? [];
          const active = users.includes(currentUserId);
          return (
            <button
              key={emoji}
              type="button"
              className={`reaction-btn${active ? " active" : ""}`}
              onClick={() => onToggleReaction(emoji)}
              aria-label={`Reaccionar con ${emoji}`}
            >
              <span>{emoji}</span>
              {users.length > 0 ? <small>{users.length}</small> : null}
            </button>
          );
        })}

        {reactions.length > 0 ? (
          <div className="reaction-summary" aria-live="polite">
            {reactions.map(([emoji, users]) => `${emoji} ${users.length}`).join("  ")}
          </div>
        ) : null}
      </div>

      <footer className="bubble-meta">
        {message.starred ? <span className="star">*</span> : null}
        <span>{message.device === "mobile" ? "Movil" : "PC"}</span>
        {message.editedAt ? <span>editado</span> : null}
        <span className={`status-chip status-${message.status ?? "sent"}`}>{statusLabel}</span>
        <span>{time}</span>
      </footer>

      {menuPos ? (
        <MessageContextMenu
          x={menuPos.x}
          y={menuPos.y}
          canCopy={canCopy}
          canOpen={canOpen}
          canEdit={canEdit}
          canRetry={canRetry}
          isStarred={message.starred}
          returnFocusTo={menuAnchor}
          onCopy={() => {
            if (message.text) onCopy(message.text);
            closeMenu();
          }}
          onOpen={() => {
            if (message.fileURL) window.open(message.fileURL, "_blank", "noopener,noreferrer");
            closeMenu();
          }}
          onEdit={() => {
            setDraftText(message.text);
            setIsEditing(true);
            closeMenu();
          }}
          onRetry={() => {
            onRetry();
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
