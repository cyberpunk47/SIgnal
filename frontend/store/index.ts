import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User, Conversation, Message, Contact } from "@/types";

// ============================================================
// Toast state
// ============================================================

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

// ============================================================
// Combined Zustand Store
// ============================================================

interface Store {
  // --- Auth ---
  token: string | null;
  currentUser: User | null;
  authExpiresAt: number | null;
  setAuth: (token: string, user: User) => void;
  setCurrentUser: (user: User) => void;
  isAuthExpired: () => boolean;
  logout: () => void;


  // --- Conversations ---
  conversations: Conversation[];
  setConversations: (convos: Conversation[]) => void;
  upsertConversation: (convo: Conversation) => void;
  activeConversationId: number | null;
  setActiveConversation: (id: number | null) => void;

  // --- Messages (keyed by conversationId) ---
  messages: Record<number, Message[]>;
  setMessages: (conversationId: number, msgs: Message[]) => void;
  prependMessages: (conversationId: number, msgs: Message[]) => void;
  appendMessage: (conversationId: number, msg: Message) => void;
  updateMessage: (conversationId: number, msg: Message) => void;
  replaceTempMessage: (conversationId: number, tempId: string, realMsg: Message) => void;

  // --- Contacts ---
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  removeContact: (id: number) => void;

  // --- User cache (id → User) ---
  userCache: Record<number, User>;
  cacheUser: (user: User) => void;
  cacheUsers: (users: User[]) => void;

  // --- Online status ---
  onlineUsers: Set<number>;
  setUserOnline: (userId: number, online: boolean) => void;
  updateUserPresence: (
    userId: number,
    isOnline: boolean,
    lastSeenAt?: string | null
  ) => void;

  updateConversationReadReceipt: (
    messageId: number,
    userId: number
  ) => void;

  /** Tracks which recipients have received each message (for delivery ticks) */
  deliveredMessages: Record<number, Set<number>>;
  markMessageDelivered: (messageId: number, userId: number) => void;

  // --- Typing ---
  typingUsers: Record<number, Set<number>>; // conversationId → Set<userId>
  setTyping: (conversationId: number, userId: number, isTyping: boolean) => void;

  // --- Toast notifications ---
  toasts: Toast[];
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;

  // --- Unread counts ---
  unreadCounts: Record<number, number>;
  setUnreadCount: (conversationId: number, count: number) => void;
  incrementUnread: (conversationId: number) => void;
  clearUnread: (conversationId: number) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // --- Auth ---
      token: null,
      currentUser: null,
      authExpiresAt: null,
      setAuth: (token, user) =>
        set({
          token,
          currentUser: user,
          authExpiresAt: Date.now() + 30 * 60 * 1000,
        }),
      setCurrentUser: (user) => set({ currentUser: user }),
      isAuthExpired: () => {
        const expiresAt = get().authExpiresAt;
        return Boolean(expiresAt && Date.now() > expiresAt);
      },
      logout: () =>
        set({
          token: null,
          currentUser: null,
          authExpiresAt: null,
          conversations: [],
          messages: {},
          contacts: [],
          userCache: {},
          onlineUsers: new Set(),
          typingUsers: {},
          unreadCounts: {},
        }),

      // --- Conversations ---
      conversations: [],
      setConversations: (convos) => set({ conversations: convos }),
      upsertConversation: (convo) =>
        set((state) => {
          const existing = state.conversations.find((c) => c.id === convo.id);
          if (existing) {
            return {
              conversations: state.conversations.map((c) =>
                c.id === convo.id ? { ...c, ...convo } : c
              ),
            };
          }
          return { conversations: [convo, ...state.conversations] };
        }),
      activeConversationId: null,
      setActiveConversation: (id) => set({ activeConversationId: id }),

      // --- Messages ---
      messages: {},
      setMessages: (conversationId, msgs) =>
        set((state) => ({
          messages: { ...state.messages, [conversationId]: msgs },
        })),
      prependMessages: (conversationId, msgs) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...msgs,
              ...(state.messages[conversationId] || []),
            ],
          },
        })),
      appendMessage: (conversationId, msg) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [
              ...(state.messages[conversationId] || []),
              msg,
            ],
          },
        })),
      updateMessage: (conversationId, msg) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
              m.id === msg.id ? msg : m
            ),
          },
        })),
      replaceTempMessage: (conversationId, tempId, realMsg) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
              m.client_temp_id === tempId ? realMsg : m
            ),
          },
        })),

      // --- Contacts ---
      contacts: [],
      setContacts: (contacts) => set({ contacts }),
      addContact: (contact) =>
        set((state) => ({ contacts: [...state.contacts, contact] })),
      removeContact: (id) =>
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
        })),

      // --- User cache ---
      userCache: {},
      cacheUser: (user) =>
        set((state) => ({
          userCache: { ...state.userCache, [user.id]: user },
        })),
      cacheUsers: (users) =>
        set((state) => {
          const updates: Record<number, User> = {};
          users.forEach((u) => (updates[u.id] = u));
          return { userCache: { ...state.userCache, ...updates } };
        }),

      // --- Online status ---
      onlineUsers: new Set(),

      setUserOnline: (userId, online) =>
        set((state) => {
          const next = new Set(state.onlineUsers);

          if (online) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          return {
            onlineUsers: next,
          };
        }),

      updateUserPresence: (userId, isOnline, lastSeenAt = null) =>
        set((state) => {
          const next = new Set(state.onlineUsers);

          if (isOnline) {
            next.add(userId);
          } else {
            next.delete(userId);
          }

          const existingUser = state.userCache[userId];

          return {
            onlineUsers: next,
            userCache: existingUser
              ? {
                ...state.userCache,
                [userId]: {
                  ...existingUser,
                  is_online: isOnline,
                  last_seen_at: isOnline
                    ? null
                    : lastSeenAt ?? existingUser.last_seen_at,
                },
              }
              : state.userCache,
          };
        }),

      updateConversationReadReceipt: (messageId, userId) =>
        set((state) => {
          const conversationEntry = Object.entries(state.messages).find(([, msgs]) =>
            msgs.some((message) => message.id === messageId)
          );

          if (!conversationEntry) return state;

          const [conversationIdString] = conversationEntry;
          const conversationId = Number(conversationIdString);

          return {
            conversations: state.conversations.map((conversation) => {
              if (conversation.id !== conversationId) return conversation;

              return {
                ...conversation,
                members: conversation.members.map((member) =>
                  member.user_id === userId
                    ? {
                      ...member,
                      last_read_message_id:
                        member.last_read_message_id && member.last_read_message_id > messageId
                          ? member.last_read_message_id
                          : messageId,
                    }
                    : member
                ),
              };
            }),
          };
        }),

      deliveredMessages: {},

      markMessageDelivered: (messageId, userId) =>
        set((state) => {
          const existing = state.deliveredMessages[messageId] ?? new Set<number>();
          const next = new Set(existing);
          next.add(userId);

          return {
            deliveredMessages: {
              ...state.deliveredMessages,
              [messageId]: next,
            },
          };
        }),
      // --- Typing ---
      typingUsers: {},
      setTyping: (conversationId, userId, isTyping) =>
        set((state) => {
          const current = new Set(state.typingUsers[conversationId] || []);
          if (isTyping) current.add(userId);
          else current.delete(userId);
          return {
            typingUsers: { ...state.typingUsers, [conversationId]: current },
          };
        }),

      // --- Toasts ---
      toasts: [],
      addToast: (message, type = "info") =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { id: Date.now().toString(), message, type },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // --- Unread counts ---
      unreadCounts: {},
      setUnreadCount: (conversationId, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [conversationId]: count },
        })),
      incrementUnread: (conversationId) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
          },
        })),
      clearUnread: (conversationId) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
        })),
    }),
    {
      name: "signal-store",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        currentUser: state.currentUser,
        authExpiresAt: state.authExpiresAt,
        userCache: state.userCache,
      }),
    }
  )
);
