import { Message } from "../../lib/types";
import { getDownloadUrl } from "../../services/controlfileDownload";
import { useState, useEffect } from "react";

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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);

  // Refresh download URL for ControlFile files
  useEffect(() => {
    const refreshUrl = async () => {
      if (message.storagePath && !message.storagePath.startsWith('workspaces/')) {
        // This is a ControlFile file
        try {
          const url = await getDownloadUrl(message.storagePath);
          setDownloadUrl(url);
          setUrlError(false);
        } catch (error) {
          console.error('Failed to get download URL:', error);
          setUrlError(true);
        }
      } else {
        // Use existing Firebase Storage URL
        setDownloadUrl(message.fileURL);
        setUrlError(false);
      }
    };

    refreshUrl();
  }, [message.storagePath, message.fileURL]);

  const effectiveUrl = downloadUrl || message.fileURL;

  if (message.type === "image" && effectiveUrl) {
    return (
      <img className="bubble-image" src={effectiveUrl} alt={message.fileName ?? "Imagen"} loading="lazy" />
    );
  }

  if (message.type === "video" && effectiveUrl) {
    return <video className="bubble-video" src={effectiveUrl} controls preload="metadata" />;
  }

  if (message.type === "file" && effectiveUrl) {
    return (
      <a className="file-row" href={effectiveUrl} target="_blank" rel="noreferrer">
        <span className="file-icon">DOC</span>
        <span>
          <strong>{message.fileName}</strong>
          <small>{formatSize(message.size)}</small>
        </span>
      </a>
    );
  }

  if ((message.type === "image" || message.type === "video" || message.type === "file") && !effectiveUrl) {
    return (
      <div className="file-row" aria-live="polite">
        <span className="file-icon">SUB</span>
        <span>
          <strong>{message.fileName}</strong>
          <small>
            {urlError ? "Error al cargar archivo" : message.status === "failed" ? "Fallo de carga" : "Cargando archivo..."}
          </small>
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
