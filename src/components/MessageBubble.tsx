import { memo, useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import { Message } from "../lib/types";
import { MessageContextMenu } from "../features/message-actions/MessageContextMenu";
import { MessageContent } from "../features/message-renderers/MessageContent";

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
}

const MessageBubbleBase = ({ message, onCopy, onDelete, onToggleStar }: Props) => {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const time = formatHour(message.createdAt?.seconds);

  const canCopy = Boolean(message.text);
  const canOpen = Boolean(message.fileURL);

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

  const messageTypeClass = useMemo(() => `bubble bubble-${message.type}`, [message.type]);

  return (
    <article className={messageTypeClass} onContextMenu={onContextMenu} onTouchStart={onTouchStart}>
      <MessageContent message={message} />

      <footer className="bubble-meta">
        {message.starred ? <span className="star">★</span> : null}
        <span>{message.device === "mobile" ? "Móvil" : "PC"}</span>
        <span>{time}</span>
        {canCopy ? (
          <button type="button" className="ghost-btn" onClick={() => onCopy(message.text)}>
            Copiar
          </button>
        ) : null}
      </footer>

      {menuPos ? (
        <MessageContextMenu
          x={menuPos.x}
          y={menuPos.y}
          canCopy={canCopy}
          canOpen={canOpen}
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
