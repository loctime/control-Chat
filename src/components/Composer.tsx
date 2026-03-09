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

type VoiceMode = "hold" | "toggle";

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
    const voiceMode: VoiceMode = import.meta.env.VITE_VOICE_MODE === "toggle" ? "toggle" : "hold";

    const [text, setText] = useState("");
    const [caption, setCaption] = useState("");
    const [pickedFile, setPickedFile] = useState<File | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const micPressedRef = useRef(false);
    const dictationBaseRef = useRef("");

    const {
      startRecording,
      stopRecording,
      cancelRecording,
      isStarting,
      isRecording,
      isProcessing,
      error: speechError,
      isSupported
    } = useSpeechRecognition({
      onTranscriptChange: (liveTranscript) => {
        const nextText = `${dictationBaseRef.current}${dictationBaseRef.current && liveTranscript ? " " : ""}${liveTranscript}`.trim();
        setText(nextText);
      },
      onEnd: (finalTranscript) => {
        const mergedText = `${dictationBaseRef.current}${dictationBaseRef.current && finalTranscript ? " " : ""}${finalTranscript}`.trim();
        setText(mergedText);
      }
    });

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

    const beginDictation = () => {
      const base = text.trim();
      dictationBaseRef.current = base;
      onClearSendError();
      startRecording();
    };

    const handleMicPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      if (voiceMode !== "hold") return;
      if (sending || isOffline || selectedFile) return;

      event.preventDefault();
      micPressedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      beginDictation();
    };

    const handleMicPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
      if (voiceMode !== "hold") return;
      if (!micPressedRef.current) return;

      event.preventDefault();
      micPressedRef.current = false;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      stopRecording();
    };

    const handleMicCancel = (event: PointerEvent<HTMLButtonElement>) => {
      if (voiceMode !== "hold") return;

      micPressedRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      cancelRecording();
      setText(dictationBaseRef.current);
    };

    const handleToggleClick = () => {
      if (voiceMode !== "toggle") return;
      if (sending || isOffline || selectedFile) return;

      if (isStarting || isRecording) {
        stopRecording();
        return;
      }

      if (isProcessing) return;
      beginDictation();
    };

    const voiceStatusLabel = isStarting
      ? "Preparando microfono..."
      : isRecording
      ? "Escuchando..."
      : isProcessing
      ? "Procesando..."
      : null;

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

        {voiceStatusLabel ? (
          <div className="composer-feedback" role="status" aria-live="polite">
            <span>{voiceStatusLabel}</span>
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
              onClick={voiceMode === "toggle" ? handleToggleClick : (e) => e.preventDefault()}
              aria-label={isRecording || isStarting ? "Stop recording" : "Start voice dictation"}
              title={
                selectedFile
                  ? "Quita el archivo adjunto para dictar"
                  : voiceMode === "hold"
                  ? "Manten apretado para dictar"
                  : isRecording || isStarting
                  ? "Toca para detener"
                  : "Toca para iniciar dictado"
              }
              disabled={sending || isOffline || Boolean(selectedFile)}
            >
              {isProcessing || isStarting ? (
                <span className="mic-spinner" aria-hidden="true" />
              ) : isRecording ? (
                <span className="record-indicator" aria-hidden="true" />
              ) : (
                "\uD83C\uDFA4"
              )}
            </button>
          ) : null}

          {isSupported && (isStarting || isRecording || isProcessing) ? (
            <button
              type="button"
              className="dictation-cancel-btn"
              onClick={() => {
                micPressedRef.current = false;
                cancelRecording();
                setText(dictationBaseRef.current);
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
