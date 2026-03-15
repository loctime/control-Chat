import { Message } from "../domain/entities";

type ConversationCache = {
  messages: Message[];
  oldestDoc: any;
  reachedEnd: boolean;
  lastUpdated: number;
};

class MessagesCache {
  private cache = new Map<string, ConversationCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  get(workspaceId: string, conversationId: string): ConversationCache | null {
    const key = this.getKey(workspaceId, conversationId);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.lastUpdated > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }

  set(workspaceId: string, conversationId: string, data: Omit<ConversationCache, 'lastUpdated'>): void {
    const key = this.getKey(workspaceId, conversationId);
    this.cache.set(key, {
      ...data,
      lastUpdated: Date.now()
    });
  }

  clear(workspaceId: string, conversationId: string): void {
    const key = this.getKey(workspaceId, conversationId);
    this.cache.delete(key);
  }

  private getKey(workspaceId: string, conversationId: string): string {
    return `${workspaceId}:${conversationId}`;
  }
}

export const messagesCache = new MessagesCache();
