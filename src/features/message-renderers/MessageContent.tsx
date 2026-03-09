import { Message } from "../../lib/types";

const formatSize = (size: number | null) => {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

interface Props {
  message: Message;
}

export const MessageContent = ({ message }: Props) => {
  if (message.type === "image" && message.fileURL) {
    return (
      <img className="bubble-image" src={message.fileURL} alt={message.fileName ?? "Imagen"} loading="lazy" />
    );
  }

  if (message.type === "video" && message.fileURL) {
    return <video className="bubble-video" src={message.fileURL} controls preload="metadata" />;
  }

  if (message.type === "file" && message.fileURL) {
    return (
      <a className="file-row" href={message.fileURL} target="_blank" rel="noreferrer">
        <span className="file-icon">DOC</span>
        <span>
          <strong>{message.fileName}</strong>
          <small>{formatSize(message.size)}</small>
        </span>
      </a>
    );
  }

  if ((message.type === "image" || message.type === "video" || message.type === "file") && !message.fileURL) {
    return (
      <div className="file-row" aria-live="polite">
        <span className="file-icon">SUB</span>
        <span>
          <strong>{message.fileName}</strong>
          <small>{message.status === "failed" ? "Fallo de carga" : "Cargando archivo..."}</small>
        </span>
      </div>
    );
  }

  if (message.type === "link") {
    return (
      <a className="link-preview" href={message.text} target="_blank" rel="noreferrer">
        {message.text}
      </a>
    );
  }

  return message.text ? <p className="bubble-text">{message.text}</p> : null;
};
