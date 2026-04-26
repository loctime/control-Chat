import { Message } from "../../lib/types";

interface Props {
  message: Message;
}

export const MessageContent = ({ message }: Props) => {
  if (message.type === "link") {
    return (
      <a className="link-preview" href={message.text} target="_blank" rel="noreferrer">
        {message.text}
      </a>
    );
  }

  return message.text ? <p className="bubble-text">{message.text}</p> : null;
};
