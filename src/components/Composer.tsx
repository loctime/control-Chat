import { ChangeEvent, ClipboardEvent, FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  onSendText: (text: string) => Promise<boolean>;
  onSendFile: (file: File, caption?: string) => Promise<boolean>;
  onRetrySend: () => Promise<boolean>;
  onClearSendError: () => void;
  sending: boolean;
  sendError: string | null;
  pendingFile: File | null;
  onClearPendingFile: () => void;
  isOffline: boolean;
}

export const Composer = ({
  onSendText,
  onSendFile,
  onRetrySend,
  onClearSendError,
  sending,
  sendError,
  pendingFile,
  onClearPendingFile,
  isOffline
}: Props) => {
  const [text, setText] = useState("");
  const [caption, setCaption] = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = pendingFile ?? pickedFile;

  useEffect(() => {
    if (!selectedFile) {
      setCaption("");
    }
  }, [selectedFile]);

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onClearSendError();
      setPickedFile(file);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const items = Array.from(event.clipboardData.items);
    const image = items.find((item) => item.type.startsWith("image/"));
    if (!image) return;

    const file = image.getAsFile();
    if (!file) return;

    onClearSendError();
    setPickedFile(file);
    event.preventDefault();
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();

    if (selectedFile) {
      const sent = await onSendFile(selectedFile, caption || text);
      if (!sent) return;

      setPickedFile(null);
      onClearPendingFile();
      setCaption("");
      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!text.trim()) return;
    const sent = await onSendText(text);
    if (!sent) return;
    setText("");
  };

  return (
    <form className="composer" onSubmit={send}>
      {selectedFile ? (
        <div className="pending-file">
          <span>{selectedFile.name}</span>
          <button
            type="button"
            onClick={() => {
              setPickedFile(null);
              onClearPendingFile();
            }}
          >
            Quitar
          </button>
        </div>
      ) : null}

      {sendError ? (
        <div className="composer-feedback" role="status" aria-live="polite">
          <span>Error al enviar. {sendError}</span>
          <button type="button" className="ghost-btn" onClick={() => void onRetrySend()} disabled={sending}>
            Reintentar
          </button>
        </div>
      ) : null}

      {sending ? (
        <div className="composer-feedback" role="status" aria-live="polite">
          <span>Enviando...</span>
        </div>
      ) : null}

      <div className="composer-row">
        <label className="attach-btn" htmlFor="file-input" title="Adjuntar archivo">
          +
        </label>
        <input id="file-input" type="file" hidden ref={fileInputRef} onChange={onPickFile} />

        <input
          className="message-input"
          placeholder={selectedFile ? "Agrega un texto opcional" : "Escribí un mensaje para vos"}
          value={selectedFile ? caption : text}
          onPaste={onPaste}
          onChange={(e) => {
            onClearSendError();
            if (selectedFile) {
              setCaption(e.target.value);
            } else {
              setText(e.target.value);
            }
          }}
        />

        <button className="send-btn" type="submit" disabled={sending || isOffline}>
          {isOffline ? "Offline" : sending ? "Enviando" : "Enviar"}
        </button>
      </div>
    </form>
  );
};
