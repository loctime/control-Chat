import { Timestamp } from "firebase/firestore";

export type MessageType = "text" | "file" | "image" | "video" | "link";

export type DeviceType = "mobile" | "desktop";
export type MessageStatus = "sending" | "sent" | "failed";
export type ReactionMap = Record<string, string[]>;

export interface ReplyTarget {
  id: string;
  text: string;
  author: string;
}

interface MessageBase {
  id: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
  editedAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
  device: DeviceType;
  status?: MessageStatus;
  clientId?: string | null;
  starred: boolean;
  author: string;
  reactions?: ReactionMap;
  replyToId: string | null;
  replyToText: string | null;
  replyToAuthor: string | null;
}

export interface TextMessage extends MessageBase {
  type: "text";
  text: string;
  fileURL: null;
  fileName: null;
  fileType: null;
  storagePath: null;
  size: null;
}

export interface LinkMessage extends MessageBase {
  type: "link";
  text: string;
  fileURL: null;
  fileName: null;
  fileType: null;
  storagePath: null;
  size: null;
}

export interface ImageMessage extends MessageBase {
  type: "image";
  text: string;
  fileURL: string;
  fileName: string;
  fileType: string | null;
  storagePath: string;
  size: number;
}

export interface VideoMessage extends MessageBase {
  type: "video";
  text: string;
  fileURL: string;
  fileName: string;
  fileType: string | null;
  storagePath: string;
  size: number;
}

export interface FileMessage extends MessageBase {
  type: "file";
  text: string;
  fileURL: string;
  fileName: string;
  fileType: string | null;
  storagePath: string;
  size: number;
}

export type Message = TextMessage | LinkMessage | ImageMessage | VideoMessage | FileMessage;
