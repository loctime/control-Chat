import { Suspense, lazy, useEffect, useState } from "react";
import { useAuthUser } from "./hooks/useAuthUser";

const AuthScreen = lazy(() => import("./components/AuthScreen").then((module) => ({ default: module.AuthScreen })));
const ChatScreen = lazy(() => import("./components/ChatScreen").then((module) => ({ default: module.ChatScreen })));

const isDesktop = () => window.matchMedia("(min-width: 769px)").matches;

const App = () => {
  const { user, loading } = useAuthUser();
  const [pendingDropFile, setPendingDropFile] = useState<File | null>(null);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!user || !isDesktop()) return;
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      if (!user || !isDesktop()) return;
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) setPendingDropFile(file);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [user]);

  if (loading) {
    return <main className="loading-screen">Cargando SELF CHAT...</main>;
  }

  return (
    <Suspense fallback={<main className="loading-screen">Cargando SELF CHAT...</main>}>
      {user ? (
        <ChatScreen
          user={user}
          pendingDropFile={pendingDropFile}
          onClearPendingDropFile={() => setPendingDropFile(null)}
        />
      ) : (
        <AuthScreen />
      )}
    </Suspense>
  );
};

export default App;
