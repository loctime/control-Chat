import { User } from "firebase/auth";

type WorkspaceView = "chat" | "notes" | "documents";

interface Props {
  user: User;
  onLogout: () => Promise<void>;
  search: string;
  onSearchChange: (value: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  conversationTitle: string;
}

export const ChatHeader = ({
  user,
  onLogout,
  search,
  onSearchChange,
  isDark,
  onToggleTheme,
  view,
  onViewChange,
  conversationTitle
}: Props) => {
  const name = user.displayName ?? user.email ?? "Usuario";
  const avatar = user.photoURL ?? "https://ui-avatars.com/api/?name=SC&background=0f172a&color=ffffff";

  return (
    <header className="chat-header">
      <div className="user-row">
        <img src={avatar} alt={name} className="avatar" />
        <div>
          <p className="header-title">CONTROLCHAT V2</p>
          <small>{conversationTitle}</small>
        </div>
        <div className="header-actions">
          <button className="ghost-btn" onClick={onToggleTheme}>
            {isDark ? "Claro" : "Oscuro"}
          </button>
          <button className="ghost-btn" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="Vistas del espacio">
        <button type="button" className={view === "chat" ? "active" : ""} onClick={() => onViewChange("chat")}>
          Chat
        </button>
        <button type="button" className={view === "notes" ? "active" : ""} onClick={() => onViewChange("notes")}>
          Notas
        </button>
        <button
          type="button"
          className={view === "documents" ? "active" : ""}
          onClick={() => onViewChange("documents")}
        >
          Documentos
        </button>
      </div>

      {view === "chat" ? (
        <>
          <input
            className="search-input"
            aria-label="Buscar en mensajes cargados"
            placeholder="Buscar en tu conversacion"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <small className="search-scope">La búsqueda aplica a los mensajes cargados del espacio actual.</small>
        </>
      ) : (
        <small className="search-scope">Hola {name}. Tu espacio ya separa chat, notas y documentos.</small>
      )}
    </header>
  );
};
