import { useEffect, useMemo, useState } from "react";
import { Note } from "../domain/entities";
import { createNote, subscribeToNotes, updateNote } from "../infrastructure/firebase/knowledge";

export const useNotes = (workspaceId: string | null, uid: string | null) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !uid) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToNotes(
      workspaceId,
      uid,
      (incoming) => {
        setNotes(incoming);
        setSelectedNoteId((current) => current ?? incoming[0]?.id ?? null);
        setLoading(false);
      },
      (notesError) => {
        setError(notesError.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [workspaceId, uid]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  );

  return {
    notes,
    selectedNote,
    selectedNoteId,
    loading,
    error,
    setSelectedNoteId,
    createNote: async () => {
      if (!workspaceId || !uid) return null;
      const nextId = await createNote(workspaceId, uid);
      setSelectedNoteId(nextId);
      return nextId;
    },
    saveNote: async (noteId: string, title: string, content: string) =>
      workspaceId ? updateNote(workspaceId, noteId, { title, content }) : Promise.resolve()
  };
};
