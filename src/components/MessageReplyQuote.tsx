interface Props {
  author: string;
  text: string;
  onClick: () => void;
}

export const MessageReplyQuote = ({ author, text, onClick }: Props) => {
  return (
    <button type="button" className="message-reply-quote" onClick={onClick}>
      <span className="message-reply-quote-author">{"->"} {author}</span>
      <span className="message-reply-quote-text">{text || "(sin texto)"}</span>
    </button>
  );
};
