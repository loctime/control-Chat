import { Suspense, lazy, useEffect, useState } from "react";
import { useAuthUser } from "./hooks/useAuthUser";

const AuthScreen = lazy(() => import("./components/AuthScreen").then((module) => ({ default: module.AuthScreen })));
const ChatScreen = lazy(() => import("./components/ChatScreen").then((module) => ({ default: module.ChatScreen })));
const ControlFileTest = lazy(() => import("./pages/ControlFileTest").then((module) => ({ default: module.ControlFileTest })));

const isDesktop = () => window.matchMedia("(min-width: 769px)").matches;
const isDevelopment = import.meta.env.DEV;

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
      {isDevelopment && (
        <div style={{ 
          position: 'fixed', 
          top: '10px', 
          right: '10px', 
          zIndex: 9999,
          backgroundColor: '#007bff',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          textDecoration: 'none'
        }}>
          <a 
            href="/controlfile-test" 
            style={{ color: 'white', textDecoration: 'none' }}
          >
            🧪 ControlFile Test
          </a>
        </div>
      )}
      {user ? (
        window.location.pathname === '/controlfile-test' ? (
          <ControlFileTest />
        ) : (
          <ChatScreen
            user={user}
            pendingDropFile={pendingDropFile}
            onClearPendingDropFile={() => setPendingDropFile(null)}
          />
        )
      ) : (
        <AuthScreen />
      )}
    </Suspense>
  );
};

export default App;
