export const APP_COLLECTION = "apps";
export const APP_ID = "control-chat";
export const legacyAppPath = [APP_COLLECTION, APP_ID] as const;

export const personalWorkspaceId = (uid: string) => `workspace-${uid}`;
export const selfConversationId = (uid: string) => `self-${uid}`;
