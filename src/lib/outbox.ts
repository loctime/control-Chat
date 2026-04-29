import { Timestamp } from "firebase/firestore";
import { DeviceType, Message, ReplyTarget } from "./types";

const VERSION = 1;
const key = (uid: string) => `chat:outbox:${uid}`;

export interface OutboxItem {
  clientId: string;
  text: string;
  author: string;
  replyTo: ReplyTarget | null;
  createdAtMs: number;
  device: DeviceType;
  failed?: boolean;
  errorMessage?: string;
}

interface OutboxPayload {
  v: number;
  items: OutboxItem[];
}

export const generateClientId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `c_${crypto.randomUUID()}`;
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const loadOutbox = (uid: string): OutboxItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxPayload;
    if (parsed?.v !== VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (item) => typeof item?.clientId === "string" && typeof item?.text === "string"
    );
  } catch {
    return [];
  }
};

export const saveOutbox = (uid: string, items: OutboxItem[]) => {
  if (typeof window === "undefined") return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(key(uid));
      return;
    }
    const payload: OutboxPayload = { v: VERSION, items };
    window.localStorage.setItem(key(uid), JSON.stringify(payload));
  } catch {
    // best-effort
  }
};

const isLink = (value: string) => /^(https?:\/\/[^\s]+)$/i.test(value.trim());

export const outboxItemToMessage = (item: OutboxItem): Message =>
  ({
    id: item.clientId,
    type: isLink(item.text) ? "link" : "text",
    text: item.text,
    createdAt: Timestamp.fromMillis(item.createdAtMs),
    device: item.device,
    starred: false,
    author: item.author,
    pending: !item.failed,
    failed: Boolean(item.failed),
    clientId: item.clientId,
    replyToId: item.replyTo?.id ?? null,
    replyToText: item.replyTo?.text ?? null,
    replyToAuthor: item.replyTo?.author ?? null
  } as Message);
