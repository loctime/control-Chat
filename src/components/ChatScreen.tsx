import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "firebase/auth";
import { logout } from "../lib/auth";
import { Composer } from "./Composer";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { useMessages } from "../hooks/useMessages";
import { Message, ReplyTarget } from "../lib/types";
import { applyTheme, getInitialTheme, ThemeMode } from "../features/theme/useTheme";
import { useWorkspace } from "../hooks/useWorkspace";
import { useNotes } from "../hooks/useNotes";
import { useDocuments } from "../hooks/useDocuments";
import { NotesScreen } from "./NotesScreen";
import { DocumentsScreen } from "./DocumentsScreen";

interface Props {
  user: User;
  pendingDropFile: File | null;
  onClearPendingDropFile: () => void;
}

type WorkspaceView = "chat" | "notes" | "documents";

export const ChatScreen = ({ user, pendingDropFile, onClearPendingDropFile }: Props) => {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const { workspace, workspaceRecord, conversation, loading: workspaceLoading, error: workspaceError } = useWorkspace(user);
  const authorSnapshot = {
    displayName: user.displayName?.trim() || user.email || "Anonimo",
    avatarUrl: user.photoURL ?? null,
    email: user.email ?? null
  };

  const {
    messages,
    loading,
    error,
    sendError,
    sendText,
    sendFile,
    retryMessage,
    retryLastFailedSend,
    clearError,
    clearSendError,
    loadMore,
    loadingMore,
    hasMore,
    uploadsProgress,
    toggleStar,
    editMessage,
    toggleReaction,
    deleteMessage,
    ensureMessageLoaded,
    fromCache,
    hasPendingWrites
  } = useMessages(user.uid, workspaceRecord?.id ?? null, conversation?.id ?? null, user.uid, authorSnapshot);

  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [replyToMessage, setReplyToMessage] = useState<ReplyTarget | null>(null);
  const [view, setView] = useState<WorkspaceView>("chat");

  const notes = useNotes(view === "notes" ? workspaceRecord?.id ?? workspace?.defaultWorkspaceId ?? null : null, user.uid);
  const documents = useDocuments(view === "documents" ? workspaceRecord?.id ?? workspace?.defaultWorkspaceId ?? null : null, user.uid);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Sin permisos de clipboard no interrumpimos el flujo.
    }
  }, []);

  const handleToggleStar = useCallback((message: Message) => toggleStar(message.id, message.starred), [toggleStar]);
  const handleDelete = useCallback((message: Message) => deleteMessage(message), [deleteMessage]);
  const handleRetryMessage = useCallback((message: Message) => void retryMessage(message.id), [retryMessage]);
  const handleEditMessage = useCallback(
    (message: Message, nextText: string) => Promise.resolve(editMessage(message.id, nextText)),
    [editMessage]
  );
  const handleToggleReaction = useCallback(
    (message: Message, emoji: string) => {
      void toggleReaction(message.id, emoji);
    },
    [toggleReaction]
  );

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage({
      id: message.id,
      text: message.text,
      author: message.author,
      authorId: message.authorId,
      authorSnapshot: message.authorSnapshot
    });

    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, []);

  const syncLabel = hasPendingWrites ? "Sincronizando cambios..." : fromCache ? "Mostrando datos cacheados" : "";
  const globalError = workspaceError ?? error;

  return (
    <main className="chat-shell">
      <ChatHeader
        user={user}
        onLogout={logout}
        search={search}
        onSearchChange={setSearch}
        isDark={theme === "dark"}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
        view={view}
        onViewChange={setView}
        conversationTitle={conversation?.title ?? workspaceRecord?.title ?? "Preparando tu espacio"}
      />

      {isOffline ? <div className="status-banner">Sin conexion. Revisa tu red para sincronizar.</div> : null}
      {!isOffline && syncLabel ? <div className="status-banner">{syncLabel}</div> : null}

      {globalError ? (
        <div
          className="error-banner"
          onClick={clearError}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              clearError();
            }
          }}
        >
          {globalError}
        </div>
      ) : null}

      {view === "chat" ? (
        <>
          <MessageList
            messages={messages}
            search={search}
            loading={loading || workspaceLoading}
            currentUserId={user.uid}
            onCopy={copyToClipboard}
            onDelete={handleDelete}
            onToggleStar={handleToggleStar}
            onReply={handleReply}
            onRetryMessage={handleRetryMessage}
            onEditMessage={handleEditMessage}
            onToggleReaction={handleToggleReaction}
            onEnsureMessageLoaded={ensureMessageLoaded}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            hasMore={hasMore}
            uploadsProgress={uploadsProgress}
          />

          <Composer
            ref={composerRef}
            onSendText={sendText}
            onSendFile={sendFile}
            onRetrySend={retryLastFailedSend}
            onClearSendError={clearSendError}
            sending={false}
            sendError={sendError}
            pendingFile={pendingDropFile}
            onClearPendingFile={() => {
              clearSendError();
              onClearPendingDropFile();
            }}
            isOffline={isOffline}
            replyToMessage={replyToMessage}
            onClearReplyToMessage={() => setReplyToMessage(null)}
          />
        </>
      ) : null}

      {view === "notes" ? (
        <NotesScreen
          notes={notes.notes}
          selectedNote={notes.selectedNote}
          loading={notes.loading}
          onSelect={notes.setSelectedNoteId}
          onCreate={notes.createNote}
          onSave={notes.saveNote}
        />
      ) : null}

      {view === "documents" ? (
        <DocumentsScreen
          documents={documents.documents}
          selectedDocument={documents.selectedDocument}
          loading={documents.loading}
          onSelect={documents.setSelectedDocumentId}
          onCreate={documents.createDocument}
          onSave={documents.saveDocument}
        />
      ) : null}
    </main>
  );
};
