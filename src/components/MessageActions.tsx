import { useState } from "react";

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
      window.setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className="message-actions">
      {canCopy ? (
        <button type="button" className="action-btn" onClick={handleCopy} title="Copiar" aria-label="Copiar mensaje">
          {copied ? "Copiado" : "Copiar"}
        </button>
      ) : null}
      <button type="button" className="action-btn" onClick={onReply} title="Responder" aria-label="Responder mensaje">
        Responder
      </button>
    </div>
  );
};
