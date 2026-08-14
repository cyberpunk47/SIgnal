import axios from "axios";
import { useStore } from "@/store";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    "https://signal-wg4o.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});
// Inject auth token from Zustand store on every request
api.interceptors.request.use((config) => {
  const state = useStore.getState();
  if (state.isAuthExpired()) {
    state.logout();
    return config;
  }

  const token = state.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear auth and redirect to /auth
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export default api;

// ============================================================
// Auth
// ============================================================

export const authApi = {
  register: (data: {
    phone_number: string;
    username?: string;
    display_name: string;
  }) => api.post("/auth/register", data),

  login: (phone_number: string) =>
    api.post("/auth/login", { phone_number }),

  verify: (phone_number: string, otp: string) =>
    api.post("/auth/verify", { phone_number, otp }),

  me: () => api.get("/auth/me"),
};

// ============================================================
// Users
// ============================================================

export const usersApi = {
  lookup: (identifier: string) =>
    api.post("/auth/lookup", { identifier }),
};

// ============================================================
// Contacts
// ============================================================

export const contactsApi = {
  list: () => api.get("/contacts"),
  add: (contact_user_id: number) =>
    api.post("/contacts", { contact_user_id }),
  update: (id: number, nickname: string | null) =>
    api.patch(`/contacts/${id}`, { nickname }),
  remove: (id: number) => api.delete(`/contacts/${id}`),
};

// ============================================================
// Conversations
// ============================================================

export const conversationsApi = {
  list: () => api.get("/conversations"),
  createDirect: (user_id: number) =>
    api.post("/conversations/direct", { user_id }),
  createGroup: (name: string, member_ids: number[]) =>
    api.post("/conversations/group", { name, member_ids }),
  addMember: (conversation_id: number, user_id: number) =>
    api.post(`/conversations/${conversation_id}/members`, { user_id }),
  removeMember: (conversation_id: number, user_id: number) =>
    api.delete(`/conversations/${conversation_id}/members`, {
      data: { user_id },
    }),
  leave: (conversation_id: number) =>
    api.post(`/conversations/${conversation_id}/leave`),
  transferAdmin: (conversation_id: number, user_id: number) =>
    api.post(`/conversations/${conversation_id}/transfer-admin`, { user_id }),
  changeMemberRole: (
    conversation_id: number,
    user_id: number,
    role: "admin" | "member"
  ) =>
    api.patch(`/conversations/${conversation_id}/members/${user_id}/role`, {
      role,
    }),
};

// ============================================================
// Messages
// ============================================================

export const messagesApi = {
  list: (
    conversation_id: number,
    params?: { limit?: number; before_message_id?: number }
  ) => api.get(`/conversations/${conversation_id}/messages`, { params }),

  send: (
    conversation_id: number,
    data: {
      content?: string;
      message_type?: string;
      reply_to_message_id?: number;
      client_temp_id: string;
    }
  ) => api.post(`/conversations/${conversation_id}/messages`, data),

  update: (message_id: number, content: string) =>
    api.patch(`/conversations/messages/${message_id}`, { content }),

  delete: (message_id: number) =>
    api.delete(`/conversations/messages/${message_id}`),

  updateStatus: (message_id: number, status: "sent" | "delivered" | "read") =>
    api.patch(`/conversations/messages/${message_id}/status`, { status }),

  receipts: (message_id: number) =>
    api.get(`/conversations/messages/${message_id}/receipts`),

  markRead: (conversation_id: number, message_id: number) =>
    api.post(`/conversations/${conversation_id}/read`, { message_id }),
};

// ============================================================
// Users (direct fetch by ID via contacts workaround)
// ============================================================
