import { useCallback, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { logout } from "../lib/auth";
import { Composer } from "./Composer";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { useMessages } from "../hooks/useMessages";
import { Message } from "../lib/types";
import { applyTheme, getInitialTheme, ThemeMode } from "../features/theme/useTheme";

interface Props {
  user: User;
  pendingDropFile: File | null;
  onClearPendingDropFile: () => void;
}

export const ChatScreen = ({ user, pendingDropFile, onClearPendingDropFile }: Props) => {
  const {
    messages,
    loading,
    error,
    sending,
    sendError,
    sendText,
    sendFile,
    retryLastFailedSend,
    clearError,
    clearSendError,
    loadMore,
    loadingMore,
    hasMore,
    uploadsProgress,
    toggleStar,
    deleteMessage,
    fromCache,
    hasPendingWrites
  } = useMessages(user.uid);

  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

  const syncLabel = hasPendingWrites ? "Sincronizando cambios..." : fromCache ? "Mostrando datos cacheados" : "";

  return (
    <main className="chat-shell">
      <ChatHeader
        user={user}
        onLogout={logout}
        search={search}
        onSearchChange={setSearch}
        isDark={theme === "dark"}
        onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      />

      {isOffline ? <div className="status-banner">Sin conexión. Revisá tu red para sincronizar.</div> : null}
      {!isOffline && syncLabel ? <div className="status-banner">{syncLabel}</div> : null}

      {error ? (
        <div className="error-banner" onClick={clearError} role="button" tabIndex={0}>
          {error}
        </div>
      ) : null}

      <MessageList
        messages={messages}
        search={search}
        loading={loading}
        onCopy={copyToClipboard}
        onDelete={handleDelete}
        onToggleStar={handleToggleStar}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        hasMore={hasMore}
        uploadsProgress={uploadsProgress}
      />

      <Composer
        onSendText={sendText}
        onSendFile={sendFile}
        onRetrySend={retryLastFailedSend}
        onClearSendError={clearSendError}
        sending={sending}
        sendError={sendError}
        pendingFile={pendingDropFile}
        onClearPendingFile={() => {
          clearSendError();
          onClearPendingDropFile();
        }}
        isOffline={isOffline}
      />
    </main>
  );
};



