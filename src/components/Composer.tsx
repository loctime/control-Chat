import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  PointerEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { ReplyPreview } from "./ReplyPreview";
import { ReplyTarget } from "../lib/types";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

interface Props {
  onSendText: (text: string, replyTo: ReplyTarget | null) => Promise<boolean>;
  onSendFile: (file: File, caption?: string, replyTo?: ReplyTarget | null) => Promise<boolean>;
  onRetrySend: () => Promise<boolean>;
  onClearSendError: () => void;
  sending: boolean;
  sendError: string | null;
  pendingFile: File | null;
  onClearPendingFile: () => void;
  isOffline: boolean;
  replyToMessage: ReplyTarget | null;
  onClearReplyToMessage: () => void;
}

export const Composer = forwardRef<HTMLTextAreaElement, Props>(
  (
    {
      onSendText,
      onSendFile,
      onRetrySend,
      onClearSendError,
      sending,
      sendError,
      pendingFile,
      onClearPendingFile,
      isOffline,
      replyToMessage,
      onClearReplyToMessage
    },
    ref
  ) => {
    const [text, setText] = useState("");
    const [caption, setCaption] = useState("");
    const [pickedFile, setPickedFile] = useState<File | null>(null);

    const [dictationBase, setDictationBase] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const shouldAutoSendRef = useRef(false);

    const { startRecording, stopRecording, isRecording, isProcessing, transcript, error: speechError, isSupported } = useSpeechRecognition();

    const selectedFile = pendingFile ?? pickedFile;

    useEffect(() => {
      if (!selectedFile) {
        setCaption("");
      }
    }, [selectedFile]);

    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => messageInputRef.current!);

    useEffect(() => {
      const input = messageInputRef.current;
      if (!input) return;
      input.style.height = "0px";
      input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }, [caption, text, selectedFile]);

    useEffect(() => {
      if (!isRecording && !isProcessing) return;
      const nextText = `${dictationBase}${dictationBase && transcript ? " " : ""}${transcript}`.trim();
      setText(nextText);
    }, [dictationBase, transcript, isRecording, isProcessing]);

    useEffect(() => {
      if (!shouldAutoSendRef.current) return;
      if (isRecording || isProcessing) return;

      shouldAutoSendRef.current = false;
      const dictated = text.trim();
      if (!dictated) return;

      void (async () => {
        const sent = await onSendText(dictated, replyToMessage);
        if (!sent) return;
        setText("");
        onClearReplyToMessage();
      })();
    }, [isRecording, isProcessing, onClearReplyToMessage, onSendText, replyToMessage, text]);

    const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onClearSendError();
        setPickedFile(file);
      }
    };

    const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
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
        const sent = await onSendFile(selectedFile, caption || text, replyToMessage);
        if (!sent) return;

        setPickedFile(null);
        onClearPendingFile();
        onClearReplyToMessage();
        setCaption("");
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (!text.trim()) return;
      const sent = await onSendText(text, replyToMessage);
      if (!sent) return;
      setText("");
      onClearReplyToMessage();
    };

    const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape" && replyToMessage) {
        event.preventDefault();
        onClearReplyToMessage();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void send(event as unknown as FormEvent);
      }
    };

    const handleMicPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      if (sending || isOffline || isProcessing || selectedFile) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onClearSendError();
      shouldAutoSendRef.current = false;
      setDictationBase(text.trim());
      startRecording();
    };

    const handleMicPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
      if (!isRecording) return;

      event.preventDefault();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      shouldAutoSendRef.current = true;
      stopRecording();
    };

    const handleMicCancel = (event: PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      shouldAutoSendRef.current = false;
      stopRecording();
      setText(dictationBase);
    };

    return (
      <form className="composer" onSubmit={send}>
        {replyToMessage ? (
          <ReplyPreview replyToMessage={replyToMessage} onCancel={onClearReplyToMessage} />
        ) : null}

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

        {speechError ? (
          <div className="composer-feedback" role="status" aria-live="polite">
            <span>{speechError}</span>
          </div>
        ) : null}

        <div className="composer-row">
          <label className="attach-btn" htmlFor="file-input" title="Adjuntar archivo" aria-label="Adjuntar archivo">
            +
          </label>
          <input id="file-input" type="file" hidden ref={fileInputRef} onChange={onPickFile} />

          <textarea
            ref={messageInputRef}
            className="message-input"
            placeholder={selectedFile ? "Agrega un texto opcional" : "Escribi un mensaje para vos"}
            value={selectedFile ? caption : text}
            onPaste={onPaste}
            rows={1}
            onKeyDown={onInputKeyDown}
            onChange={(e) => {
              onClearSendError();
              if (selectedFile) {
                setCaption(e.target.value);
              } else {
                setText(e.target.value);
              }
            }}
          />

          {isSupported ? (
            <button
              type="button"
              className={`mic-btn ${isRecording ? "mic-btn-recording" : ""}`}
              onPointerDown={handleMicPointerDown}
              onPointerUp={handleMicPointerUp}
              onPointerCancel={handleMicCancel}
              onPointerLeave={handleMicCancel}
              onClick={(e) => e.preventDefault()}
              aria-label={isRecording ? "Stop recording" : "Start voice dictation"}
              title={selectedFile ? "Quita el archivo adjunto para dictar" : "Manten apretado para dictar"}
              disabled={sending || isOffline || isProcessing || Boolean(selectedFile)}
            >
              {isProcessing ? (
                <span className="mic-spinner" aria-hidden="true" />
              ) : isRecording ? (
                <span className="record-indicator" aria-hidden="true" />
              ) : (
                "\uD83C\uDFA4"
              )}
            </button>
          ) : null}

          {isSupported && (isRecording || isProcessing) ? (
            <button
              type="button"
              className="dictation-cancel-btn"
              onClick={() => {
                shouldAutoSendRef.current = false;
                stopRecording();
                setText(dictationBase);
              }}
            >
              Cancelar
            </button>
          ) : null}

          <button className="send-btn" type="submit" disabled={sending || isOffline}>
            {isOffline ? "Offline" : sending ? "Enviando" : "Enviar"}
          </button>
        </div>
      </form>
    );
  }
);

Composer.displayName = "Composer";
