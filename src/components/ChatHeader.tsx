import { User } from "firebase/auth";

interface Props {
  user: User;
  onLogout: () => Promise<void>;
  search: string;
  onSearchChange: (value: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const ChatHeader = ({ user, onLogout, search, onSearchChange, isDark, onToggleTheme }: Props) => {
  const name = user.displayName ?? user.email ?? "Usuario";
  const avatar = user.photoURL ?? "https://ui-avatars.com/api/?name=SC&background=0f172a&color=ffffff";

  return (
    <header className="chat-header">
      <div className="user-row">
        <img src={avatar} alt={name} className="avatar" />
        <div>
          <p className="header-title">SELF CHAT</p>
          <small>{name}</small>
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

      <input
        className="search-input"
        aria-label="Buscar en mensajes cargados"
        placeholder="Buscar en tus mensajes"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <small className="search-scope">La búsqueda aplica a los mensajes cargados.</small>
    </header>
  );
};
