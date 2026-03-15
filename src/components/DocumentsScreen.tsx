import { useEffect, useState } from "react";
import { DocumentRecord } from "../domain/entities";

interface Props {
  documents: DocumentRecord[];
  selectedDocument: DocumentRecord | null;
  loading: boolean;
  onSelect: (documentId: string) => void;
  onCreate: () => Promise<unknown>;
  onSave: (documentId: string, title: string, content: string) => Promise<void>;
}

export const DocumentsScreen = ({
  documents,
  selectedDocument,
  loading,
  onSelect,
  onCreate,
  onSave
}: Props) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setTitle(selectedDocument?.title ?? "");
    setContent(selectedDocument?.content ?? "");
  }, [selectedDocument?.id, selectedDocument?.title, selectedDocument?.content]);

  if (loading) {
    return <section className="knowledge-screen">Cargando documentos...</section>;
  }

  return (
    <section className="knowledge-screen">
      <aside className="knowledge-sidebar">
        <div className="knowledge-sidebar-header">
          <h2>Documentos</h2>
          <button type="button" className="ghost-btn" onClick={() => void onCreate()}>
            Nuevo
          </button>
        </div>
        <div className="knowledge-list">
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              className={`knowledge-list-item${selectedDocument?.id === document.id ? " active" : ""}`}
              onClick={() => onSelect(document.id)}
            >
              <strong>{document.title}</strong>
              <small>{document.content.slice(0, 72) || "Documento vacio"}</small>
            </button>
          ))}
          {documents.length === 0 ? <p className="empty-state">Todavia no hay documentos.</p> : null}
        </div>
      </aside>

      <div className="knowledge-editor">
        {selectedDocument ? (
          <>
            <input
              className="knowledge-title-input"
              value={title}
              placeholder="Titulo del documento"
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              className="knowledge-textarea knowledge-textarea-document"
              value={content}
              placeholder="Escribi un documento largo, una reunion o un brief..."
              onChange={(event) => setContent(event.target.value)}
            />
            <div className="knowledge-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void onSave(selectedDocument.id, title, content)}
              >
                Guardar documento
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">Crea un documento para organizar conocimiento largo.</div>
        )}
      </div>
    </section>
  );
};
