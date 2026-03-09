import { useState } from "react";
import { Copy, Reply, Check } from "lucide-react";

interface Props {
  text?: string;
  onReply: () => void;
}

export const MessageActions = ({ text = "", onReply }: Props) => {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(text.trim());

  const handleCopy = async () => {
    if (!canCopy) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="message-actions">
      {canCopy ? (
        <button
          type="button"
          className="action-btn"
          onClick={handleCopy}
          title="Copiar"
          aria-label="Copiar mensaje"
        >
          {copied ? (
            <Check size={16} className="text-muted-foreground" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        className="action-btn"
        onClick={onReply}
        title="Responder"
        aria-label="Responder mensaje"
      >
        <Reply size={16} className="text-muted-foreground" />
      </button>
    </div>
  );
};
