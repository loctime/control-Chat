import { Suspense, lazy } from "react";
import { useAuthUser } from "./hooks/useAuthUser";

const AuthScreen = lazy(() => import("./components/AuthScreen").then((module) => ({ default: module.AuthScreen })));
const ChatScreen = lazy(() => import("./components/ChatScreen").then((module) => ({ default: module.ChatScreen })));

const App = () => {
  const { user, loading } = useAuthUser();

  if (loading) {
    return <main className="loading-screen">Cargando SELF CHAT...</main>;
  }

  return (
    <Suspense fallback={<main className="loading-screen">Cargando SELF CHAT...</main>}>
      {user ? <ChatScreen user={user} /> : <AuthScreen />}
    </Suspense>
  );
};

export default App;
