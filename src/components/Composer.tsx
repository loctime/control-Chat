import {
  ChangeEvent,
  FormEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { ReplyPreview } from "./ReplyPreview";
import { ReplyTarget } from "../lib/types";

interface Props {
  onSendText: (text: string, replyTo: ReplyTarget | null) => boolean;
  onRetrySend: () => boolean;
  onClearSendError: () => void;
  sendError: string | null;
  replyToMessage: ReplyTarget | null;
  onClearReplyToMessage: () => void;
}

export const Composer = forwardRef<HTMLInputElement, Props>(
  (
    {
      onSendText,
      onRetrySend,
      onClearSendError,
      sendError,
      replyToMessage,
      onClearReplyToMessage
    },
    ref
  ) => {
    const [text, setText] = useState("");
    const messageInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => messageInputRef.current!);

    const send = (event: FormEvent) => {
      event.preventDefault();

      if (!text.trim()) return;

      const textToSend = text;
      const replyTo = replyToMessage;
      const sent = onSendText(textToSend, replyTo);

      if (sent) {
        // Envio en segundo plano: el mensaje ya esta visible via outbox optimista.
        setText("");
        onClearReplyToMessage();
      }
    };

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
      onClearSendError();
      setText(event.target.value);
    };

    return (
      <form className="composer" onSubmit={send}>
        {replyToMessage ? (
          <ReplyPreview replyToMessage={replyToMessage} onCancel={onClearReplyToMessage} />
        ) : null}

        {sendError ? (
          <div className="composer-feedback" role="status" aria-live="polite">
            <span>Error al enviar. {sendError}</span>
            <button type="button" className="ghost-btn" onClick={() => onRetrySend()}>
              Reintentar
            </button>
          </div>
        ) : null}

        <div className="composer-row">
          <input
            ref={messageInputRef}
            className="message-input"
            placeholder="Escribi un mensaje para vos"
            value={text}
            onChange={onChange}
          />

          <button className="send-btn" type="submit">
            Enviar
          </button>
        </div>
      </form>
    );
  }
);

Composer.displayName = "Composer";
