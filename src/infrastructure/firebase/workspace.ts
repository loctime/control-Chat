import { User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Conversation, UserWorkspace, Workspace } from "../../domain/entities";
import { personalWorkspaceId, selfConversationId } from "./paths";

const userDoc = (uid: string) => doc(db, "users", uid);
const workspaceDoc = (workspaceId: string) => doc(db, "workspaces", workspaceId);
const workspaceMemberDoc = (workspaceId: string, uid: string) =>
  doc(db, "workspaces", workspaceId, "members", uid);
const conversationDoc = (workspaceId: string, conversationId: string) =>
  doc(db, "workspaces", workspaceId, "conversations", conversationId);
const conversationMemberDoc = (workspaceId: string, conversationId: string, uid: string) =>
  doc(db, "workspaces", workspaceId, "conversations", conversationId, "members", uid);

const mapUserWorkspace = (uid: string, data: Record<string, unknown> | undefined): UserWorkspace => ({
  id: uid,
  uid,
  email: typeof data?.email === "string" ? data.email : null,
  name: typeof data?.name === "string" ? data.name : "Usuario",
  avatar: typeof data?.avatar === "string" ? data.avatar : null,
  createdAt: (data?.createdAt as UserWorkspace["createdAt"]) ?? null,
  updatedAt: (data?.updatedAt as UserWorkspace["updatedAt"]) ?? null,
  defaultWorkspaceId:
    typeof data?.defaultWorkspaceId === "string" ? data.defaultWorkspaceId : personalWorkspaceId(uid),
  defaultConversationId:
    typeof data?.defaultConversationId === "string" ? data.defaultConversationId : selfConversationId(uid)
});

const mapWorkspace = (
  workspaceId: string,
  uid: string,
  data: Record<string, unknown> | undefined
): Workspace => ({
  id: workspaceId,
  ownerId: typeof data?.ownerId === "string" ? data.ownerId : uid,
  title: typeof data?.title === "string" ? data.title : "Mi espacio",
  createdAt: (data?.createdAt as Workspace["createdAt"]) ?? null,
  updatedAt: (data?.updatedAt as Workspace["updatedAt"]) ?? null,
  defaultConversationId:
    typeof data?.defaultConversationId === "string" ? data.defaultConversationId : selfConversationId(uid),
  defaultAssistantMode: data?.defaultAssistantMode === "personal" ? "personal" : "off"
});

const mapConversation = (
  workspaceId: string,
  conversationId: string,
  uid: string,
  data: Record<string, unknown> | undefined
): Conversation => ({
  id: conversationId,
  workspaceId,
  title: typeof data?.title === "string" ? data.title : "Mi espacio",
  type:
    data?.type === "assistant" || data?.type === "direct" || data?.type === "group" || data?.type === "topic"
      ? data.type
      : "self",
  ownerId: typeof data?.ownerId === "string" ? data.ownerId : uid,
  createdAt: (data?.createdAt as Conversation["createdAt"]) ?? null,
  updatedAt: (data?.updatedAt as Conversation["updatedAt"]) ?? null,
  lastMessageAt: (data?.lastMessageAt as Conversation["lastMessageAt"]) ?? null,
  memberIds: Array.isArray(data?.memberIds)
    ? data.memberIds.filter((entry): entry is string => typeof entry === "string")
    : [uid],
  defaultAssistantMode: data?.defaultAssistantMode === "personal" ? "personal" : "off"
});

export const buildAuthorSnapshot = (user: User) => ({
  displayName: user.displayName?.trim() || user.email || "Anonimo",
  avatarUrl: user.photoURL ?? null,
  email: user.email ?? null
});

export const ensureUserWorkspace = async (user: User) => {
  const workspaceId = personalWorkspaceId(user.uid);
  const conversationId = selfConversationId(user.uid);
  const nextUserRef = userDoc(user.uid);
  const nextWorkspaceRef = workspaceDoc(workspaceId);
  const nextWorkspaceMemberRef = workspaceMemberDoc(workspaceId, user.uid);
  const nextConversationRef = conversationDoc(workspaceId, conversationId);
  const nextConversationMemberRef = conversationMemberDoc(workspaceId, conversationId, user.uid);
  const [
    existingUser,
    existingWorkspace,
    existingWorkspaceMember,
    existingConversation,
    existingConversationMember
  ] = await Promise.all([
    getDoc(nextUserRef),
    getDoc(nextWorkspaceRef),
    getDoc(nextWorkspaceMemberRef),
    getDoc(nextConversationRef),
    getDoc(nextConversationMemberRef)
  ]);

  const existingWorkspaceData = existingWorkspace.data();
  const existingWorkspaceMemberData = existingWorkspaceMember.data();
  const existingConversationData = existingConversation.data();
  const existingConversationMemberData = existingConversationMember.data();

  // Only write if documents don't exist or data has changed
  const userNeedsUpdate = !existingUser.exists() || 
    existingUser.data().email !== user.email ||
    existingUser.data().name !== user.displayName ||
    existingUser.data().avatar !== user.photoURL;

  if (userNeedsUpdate) {
    await setDoc(
      nextUserRef,
      {
        uid: user.uid,
        email: user.email ?? null,
        name: user.displayName ?? "Usuario",
        avatar: user.photoURL ?? null,
        defaultWorkspaceId: workspaceId,
        defaultConversationId: conversationId,
        updatedAt: serverTimestamp(),
        createdAt: existingUser.exists() ? existingUser.data().createdAt ?? serverTimestamp() : serverTimestamp()
      },
      { merge: true }
    );
  }

  const workspaceNeedsUpdate = !existingWorkspace.exists() ||
    existingWorkspaceData?.ownerId !== user.uid ||
    (typeof existingWorkspaceData?.title !== "string" || existingWorkspaceData.title.length === 0);

  if (workspaceNeedsUpdate) {
    await setDoc(
      nextWorkspaceRef,
      {
        ownerId: user.uid,
        title:
          typeof existingWorkspaceData?.title === "string" && existingWorkspaceData.title.length > 0
            ? existingWorkspaceData.title
            : "Mi espacio",
        defaultConversationId: conversationId,
        defaultAssistantMode:
          existingWorkspaceData?.defaultAssistantMode === "personal" ? "personal" : "off",
        updatedAt: serverTimestamp(),
        createdAt: existingWorkspaceData?.createdAt ?? serverTimestamp()
      },
      { merge: true }
    );
  }

  if (!existingWorkspaceMember.exists()) {
    await setDoc(
      nextWorkspaceMemberRef,
      {
        workspaceId,
        userId: user.uid,
        role: "owner",
        joinedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  const conversationNeedsUpdate = !existingConversation.exists() ||
    existingConversationData?.ownerId !== user.uid ||
    !Array.isArray(existingConversationData?.memberIds) ||
    existingConversationData.memberIds.length === 0;

  if (conversationNeedsUpdate) {
    await setDoc(
      nextConversationRef,
      {
        workspaceId,
        title:
          typeof existingConversationData?.title === "string" && existingConversationData.title.length > 0
            ? existingConversationData.title
            : "Mi espacio",
        type:
          existingConversationData?.type === "assistant" ||
          existingConversationData?.type === "direct" ||
          existingConversationData?.type === "group" ||
          existingConversationData?.type === "topic"
            ? existingConversationData.type
            : "self",
        ownerId: user.uid,
        memberIds: Array.isArray(existingConversationData?.memberIds)
          ? existingConversationData.memberIds.filter((entry): entry is string => typeof entry === "string")
          : [user.uid],
        defaultAssistantMode:
          existingConversationData?.defaultAssistantMode === "personal" ? "personal" : "off",
        updatedAt: serverTimestamp(),
        createdAt: existingConversationData?.createdAt ?? serverTimestamp(),
        lastMessageAt: existingConversationData?.lastMessageAt ?? null
      },
      { merge: true }
    );
  }

  if (!existingConversationMember.exists()) {
    await setDoc(
      nextConversationMemberRef,
      {
        workspaceId,
        conversationId,
        userId: user.uid,
        role: "owner",
        joinedAt: serverTimestamp(),
        lastReadMessageId: null,
        muted: false,
        archived: false,
        notificationLevel: "all"
      },
      { merge: true }
    );
  }

  return { workspaceId, conversationId };
};

export const getWorkspace = async (uid: string) => {
  const userSnap = await getDoc(userDoc(uid));
  const userWorkspace = mapUserWorkspace(uid, userSnap.data());
  const workspaceSnap = await getDoc(workspaceDoc(userWorkspace.defaultWorkspaceId));
  const workspace = mapWorkspace(userWorkspace.defaultWorkspaceId, uid, workspaceSnap.data());
  const conversationSnap = await getDoc(conversationDoc(workspace.id, userWorkspace.defaultConversationId));

  return {
    workspace: userWorkspace,
    workspaceRecord: workspace,
    conversation: mapConversation(workspace.id, userWorkspace.defaultConversationId, uid, conversationSnap.data())
  };
};

export const subscribeToWorkspace = (
  uid: string,
  cb: (payload: { workspace: UserWorkspace; workspaceRecord: Workspace; conversation: Conversation }) => void,
  onError: (error: Error) => void
) => {
  let currentWorkspaceId: string | null = null;
  let currentConversationId: string | null = null;
  let workspaceUnsub: (() => void) | undefined;
  let conversationUnsub: (() => void) | undefined;

  const userUnsub = onSnapshot(
    userDoc(uid),
    (userSnap) => {
      const userWorkspace = mapUserWorkspace(uid, userSnap.data());
      const newWorkspaceId = userWorkspace.defaultWorkspaceId;
      const newConversationId = userWorkspace.defaultConversationId;

      // Only update listeners if workspace or conversation changed
      if (newWorkspaceId !== currentWorkspaceId) {
        currentWorkspaceId = newWorkspaceId;
        currentConversationId = newConversationId;

        // Cleanup old listeners
        workspaceUnsub?.();
        conversationUnsub?.();

        // Setup new workspace listener
        workspaceUnsub = onSnapshot(
          workspaceDoc(newWorkspaceId),
          (workspaceSnap) => {
            const workspace = mapWorkspace(newWorkspaceId, uid, workspaceSnap.data());
            
            // Setup conversation listener
            conversationUnsub = onSnapshot(
              conversationDoc(newWorkspaceId, newConversationId),
              (conversationSnap) => {
                cb({
                  workspace: userWorkspace,
                  workspaceRecord: workspace,
                  conversation: mapConversation(newWorkspaceId, newConversationId, uid, conversationSnap.data())
                });
              },
              (error) => onError(error)
            );
          },
          (error) => onError(error)
        );
      } else if (newConversationId !== currentConversationId) {
        currentConversationId = newConversationId;
        
        // Only update conversation listener
        conversationUnsub?.();
        conversationUnsub = onSnapshot(
          conversationDoc(newWorkspaceId!, newConversationId),
          (conversationSnap) => {
            // Get current workspace data
            getDoc(workspaceDoc(newWorkspaceId!)).then(workspaceSnap => {
              const workspace = mapWorkspace(newWorkspaceId!, uid, workspaceSnap.data());
              cb({
                workspace: userWorkspace,
                workspaceRecord: workspace,
                conversation: mapConversation(newWorkspaceId!, newConversationId, uid, conversationSnap.data())
              });
            });
          },
          (error) => onError(error)
        );
      }
    },
    (error) => onError(error)
  );

  return () => {
    userUnsub();
    workspaceUnsub?.();
    conversationUnsub?.();
  };
};
