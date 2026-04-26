import { Timestamp } from "firebase/firestore";
import { Message } from "./types";

const CACHE_VERSION = 1;
// Igualamos al page size de mobile (30) para que el primer snapshot del server
// no provoque la sensacion de "se perdieron mensajes" durante la transicion.
const CACHE_MAX_MESSAGES = 30;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const cacheKey = (uid: string) => `chat:messages:${uid}`;

interface SerializedTimestamp {
  seconds: number;
  nanoseconds: number;
}

type SerializedMessage = Omit<Message, "createdAt"> & {
  createdAt: SerializedTimestamp | null;
};

interface CachePayload {
  v: number;
  ts: number;
  messages: SerializedMessage[];
}

const serialize = (message: Message): SerializedMessage => ({
  ...message,
  pending: false,
  createdAt: message.createdAt
    ? { seconds: message.createdAt.seconds, nanoseconds: message.createdAt.nanoseconds }
    : null
});

const deserialize = (raw: SerializedMessage): Message =>
  ({
    ...raw,
    pending: false,
    createdAt: raw.createdAt
      ? new Timestamp(raw.createdAt.seconds, raw.createdAt.nanoseconds)
      : null
  } as Message);

export const loadCachedMessages = (uid: string): Message[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(uid));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed?.v !== CACHE_VERSION || !Array.isArray(parsed.messages)) return null;
    if (Date.now() - parsed.ts > CACHE_MAX_AGE_MS) return null;

    return parsed.messages.map(deserialize);
  } catch {
    return null;
  }
};

export const saveCachedMessages = (uid: string, messages: Message[]) => {
  if (typeof window === "undefined") return;
  try {
    const last = messages.slice(-CACHE_MAX_MESSAGES);
    const payload: CachePayload = {
      v: CACHE_VERSION,
      ts: Date.now(),
      messages: last.map(serialize)
    };
    window.localStorage.setItem(cacheKey(uid), JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable — caching es best-effort.
  }
};

export const clearCachedMessages = (uid: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cacheKey(uid));
  } catch {
    // ignore
  }
};
