import { useEffect, useState } from "react";
import { Note } from "../domain/entities";

interface Props {
  notes: Note[];
  selectedNote: Note | null;
  loading: boolean;
  onSelect: (noteId: string) => void;
  onCreate: () => Promise<unknown>;
  onSave: (noteId: string, title: string, content: string) => Promise<void>;
}

export const NotesScreen = ({ notes, selectedNote, loading, onSelect, onCreate, onSave }: Props) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setTitle(selectedNote?.title ?? "");
    setContent(selectedNote?.content ?? "");
  }, [selectedNote?.id, selectedNote?.title, selectedNote?.content]);

  if (loading) {
    return <section className="knowledge-screen">Cargando notas...</section>;
  }

  return (
    <section className="knowledge-screen">
      <aside className="knowledge-sidebar">
        <div className="knowledge-sidebar-header">
          <h2>Notas</h2>
          <button type="button" className="ghost-btn" onClick={() => void onCreate()}>
            Nueva
          </button>
        </div>
        <div className="knowledge-list">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`knowledge-list-item${selectedNote?.id === note.id ? " active" : ""}`}
              onClick={() => onSelect(note.id)}
            >
              <strong>{note.title}</strong>
              <small>{note.content.slice(0, 72) || "Nota vacia"}</small>
            </button>
          ))}
          {notes.length === 0 ? <p className="empty-state">Todavia no hay notas.</p> : null}
        </div>
      </aside>

      <div className="knowledge-editor">
        {selectedNote ? (
          <>
            <input
              className="knowledge-title-input"
              value={title}
              placeholder="Titulo de la nota"
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              className="knowledge-textarea"
              value={content}
              placeholder="Escribi ideas, enlaces o recuerdos..."
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="knowledge-actions">
              <button type="button" className="btn btn-primary" onClick={() => void onSave(selectedNote.id, title, content)}>
                Guardar nota
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">Crea una nota para empezar a construir tu base de conocimiento.</div>
        )}
      </div>
    </section>
  );
};
