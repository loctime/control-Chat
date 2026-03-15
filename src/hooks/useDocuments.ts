import { useEffect, useMemo, useState } from "react";
import { DocumentRecord } from "../domain/entities";
import {
  createDocument,
  subscribeToDocuments,
  updateDocument
} from "../infrastructure/firebase/knowledge";

export const useDocuments = (workspaceId: string | null, uid: string | null) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !uid) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToDocuments(
      workspaceId,
      uid,
      (incoming) => {
        setDocuments(incoming);
        setSelectedDocumentId((current) => current ?? incoming[0]?.id ?? null);
        setLoading(false);
      },
      (documentsError) => {
        setError(documentsError.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [workspaceId, uid]);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId]
  );

  return {
    documents,
    selectedDocument,
    selectedDocumentId,
    loading,
    error,
    setSelectedDocumentId,
    createDocument: async () => {
      if (!workspaceId || !uid) return null;
      const nextId = await createDocument(workspaceId, uid);
      setSelectedDocumentId(nextId);
      return nextId;
    },
    saveDocument: async (documentId: string, title: string, content: string) =>
      workspaceId ? updateDocument(workspaceId, documentId, { title, content }) : Promise.resolve()
  };
};
