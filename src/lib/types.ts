import { Timestamp } from "firebase/firestore";

export type MessageType = "text" | "link";

export type DeviceType = "mobile" | "desktop";

export interface ReplyTarget {
  id: string;
  text: string;
  author: string;
}

interface MessageBase {
  id: string;
  createdAt: Timestamp | null;
  device: DeviceType;
  starred: boolean;
  author: string;
  replyToId: string | null;
  replyToText: string | null;
  replyToAuthor: string | null;
  pending?: boolean;
}

export interface TextMessage extends MessageBase {
  type: "text";
  text: string;
}

export interface LinkMessage extends MessageBase {
  type: "link";
  text: string;
}

export type Message = TextMessage | LinkMessage;
