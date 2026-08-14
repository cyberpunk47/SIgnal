// ============================================================
// All TypeScript types matching the FastAPI backend schemas
// ============================================================

export interface User {
  id: number;
  username: string;
  phone_number: string | null;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
}

export interface AuthState {
  token: string;
  user_id: number;
  username: string;
  display_name: string;
}

export type MessageType = "text" | "image" | "file" | "system";
export type MessageStatus = "sent" | "delivered" | "read";
export type ConversationType = "direct" | "group";
export type ChatRole = "admin" | "member";

export interface MessageStatusRecord {
  message_id: number;
  user_id: number;
  status: MessageStatus;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string | null;
  message_type: MessageType;
  reply_to_message_id: number | null;
  client_temp_id: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface ConversationMember {
  user_id: number;
  role: ChatRole;
  joined_at: string;
  last_read_message_id: number | null;
  is_muted: boolean;
  left_at: string | null;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: number | null;
  created_at: string;
  last_message_at: string | null;
  members: ConversationMember[];
  // Enriched on the frontend
  lastMessage?: Message;
  unreadCount?: number;
  otherUser?: User; // For direct chats
}

export interface Contact {
  id: number;
  contact_user_id: number;
  nickname: string | null;
  created_at: string;
  // Enriched on frontend
  user?: User;
}

export interface Block {
  id: number;
  blocked_user_id: number;
  created_at: string;
}

export type WsEvent =
  | {
    type: "new_message";
    message: Message;
  }
  | {
    type: "typing";
    conversation_id: number;
    user_id: number;
    is_typing: boolean;
  }
  | {
    type: "user_online";
    user_id: number;
  }
  | {
    type: "user_offline";
    user_id: number;
    last_seen_at: string | null;
  }
  | {
    type: "message_read";
    message_id: number;
    user_id: number;
  }
  | {
    type: "message_delivered";
    message_id: number;
    user_id: number;
  }
  | {
    type: "member_added";
    conversation_id: number;
    user_id: number;
  }
  | {
    type: "member_removed";
    conversation_id: number;
    user_id: number;
  };
