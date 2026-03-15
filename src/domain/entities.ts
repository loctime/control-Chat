import { Timestamp } from "firebase/firestore";

export type MessageType = "text" | "file" | "image" | "video" | "link";
export type MessageKind = "text" | "rich_text" | "attachment" | "system" | "assistant" | "reference";
export type DeviceType = "mobile" | "desktop";
export type MessageStatus = "sending" | "sent" | "failed";
export type ConversationType = "self" | "direct" | "group" | "assistant" | "topic";
export type NotificationLevel = "all" | "mentions" | "none";
export type NoteStatus = "active" | "archived";
export type DocumentEditorType = "plain" | "blocks";

export type ReactionMap = Record<string, string[]>;
export type ReactionCountMap = Record<string, number>;

export interface AuthorSnapshot {
  displayName: string;
  avatarUrl: string | null;
  email?: string | null;
}

export interface ReplyPreview {
  messageId: string;
  text: string;
  authorId: string | null;
  authorSnapshot: AuthorSnapshot | null;
}

export interface ReplyTarget {
  id: string;
  text: string;
  author: string;
  authorId?: string | null;
  authorSnapshot?: AuthorSnapshot | null;
}

export interface RelatedEntityRef {
  entityType: "message" | "note" | "document" | "link" | "conversation";
  entityId: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  title: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  defaultConversationId: string;
  defaultAssistantMode: "off" | "personal";
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: Timestamp | null;
}

export interface AttachmentRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  conversationId: string;
  messageId: string;
  kind: Extract<MessageType, "file" | "image" | "video">;
  name: string;
  mimeType: string | null;
  url: string;
  storagePath: string;
  size: number;
  createdAt: Timestamp | null;
  status: "uploaded" | "processing";
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  type: ConversationType;
  ownerId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastMessageAt: Timestamp | null;
  memberIds: string[];
  defaultAssistantMode: "off" | "personal";
}

export interface ConversationMember {
  id: string;
  workspaceId: string;
  conversationId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: Timestamp | null;
  lastReadMessageId: string | null;
  muted: boolean;
  archived: boolean;
  notificationLevel: NotificationLevel;
}

export interface UserWorkspace {
  id: string;
  uid: string;
  email: string | null;
  name: string;
  avatar: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  defaultWorkspaceId: string;
  defaultConversationId: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  status: NoteStatus;
  tagIds: string[];
  sourceMessageId: string | null;
  documentId: string | null;
  summary: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DocumentRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  content: string;
  editorType: DocumentEditorType;
  summary: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface LinkRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetEntityType: string;
  targetEntityId: string;
  linkType: string;
  createdAt: Timestamp | null;
}

export interface Message {
  id: string;
  workspaceId: string;
  conversationId: string;
  threadId: string | null;
  threadRootMessageId: string | null;
  kind: MessageKind;
  type: MessageType;
  body: string;
  text: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  editedAt: Timestamp | null;
  deletedAt: Timestamp | null;
  device: DeviceType;
  originDevice: DeviceType;
  status: MessageStatus;
  ingestState: MessageStatus;
  clientId: string | null;
  starred: boolean;
  author: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot | null;
  reactions: ReactionMap;
  reactionCounts: ReactionCountMap;
  replyToId: string | null;
  replyToText: string | null;
  replyToAuthor: string | null;
  replyToMessageId: string | null;
  replyPreview: ReplyPreview | null;
  relatedEntityRefs: RelatedEntityRef[];
  attachmentIds: string[];
  fileURL: string | null;
  fileName: string | null;
  fileType: string | null;
  storagePath: string | null;
  size: number | null;
  visibility: "visible" | "deleted";
  source: "user" | "assistant" | "system";
  contentVersion: number;
}
