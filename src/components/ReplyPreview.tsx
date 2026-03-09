import { ReplyTarget } from "../lib/types";

interface Props {
  replyToMessage: ReplyTarget;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyToMessage, onCancel }: Props) => {
  return (
    <div className="reply-preview" role="status" aria-live="polite">
      <div>
        <p className="reply-preview-title">Respondiendo a {replyToMessage.author}</p>
        <p className="reply-preview-text">{replyToMessage.text || "(sin texto)"}</p>
      </div>
      <button type="button" className="reply-preview-close" onClick={onCancel} aria-label="Cancelar respuesta">
        X
      </button>
    </div>
  );
};