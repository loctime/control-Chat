import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { Conversation, UserWorkspace, Workspace } from "../domain/entities";
import { migrateLegacyMessagesToConversation } from "../infrastructure/firebase/message-migrations";
import {
  buildAuthorSnapshot,
  ensureUserWorkspace,
  getWorkspace,
  subscribeToWorkspace
} from "../infrastructure/firebase/workspace";

export const useWorkspace = (user: User | null) => {
  const [workspace, setWorkspace] = useState<UserWorkspace | null>(null);
  const [workspaceRecord, setWorkspaceRecord] = useState<Workspace | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspace(null);
      setWorkspaceRecord(null);
      setConversation(null);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;

    ensureUserWorkspace(user)
      .then(async ({ workspaceId, conversationId }) => {
        const initial = await getWorkspace(user.uid);
        setWorkspace(initial.workspace);
        setWorkspaceRecord(initial.workspaceRecord);
        setConversation(initial.conversation);
        setLoading(false);

        unsub = subscribeToWorkspace(
          user.uid,
          (payload) => {
            setWorkspace(payload.workspace);
            setWorkspaceRecord(payload.workspaceRecord);
            setConversation(payload.conversation);
            setError(null);
          },
          (workspaceError) => setError(workspaceError.message)
        );

        // Run migration in background after UI is ready
        void migrateLegacyMessagesToConversation(
          user.uid,
          workspaceId,
          conversationId,
          buildAuthorSnapshot(user)
        );
      })
      .catch((workspaceError) => {
        setError(workspaceError instanceof Error ? workspaceError.message : "No se pudo cargar el espacio.");
        setLoading(false);
      });

    return () => unsub?.();
  }, [user]);

  return { workspace, workspaceRecord, conversation, loading, error };
};
