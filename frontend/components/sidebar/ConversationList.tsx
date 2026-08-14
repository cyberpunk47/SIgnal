"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import type { Conversation } from "@/types";
import Avatar from "@/components/ui/Avatar";
import {
  formatConversationTime,
  truncate,
} from "@/lib/utils";
import { Users } from "lucide-react";

interface Props {
  searchQuery: string;
}

export default function ConversationList({ searchQuery }: Props) {
  const router = useRouter();
  const conversations = useStore((s) => s.conversations);
  const currentUser = useStore((s) => s.currentUser);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const userCache = useStore((s) => s.userCache);
  const onlineUsers = useStore((s) => s.onlineUsers);
  const unreadCounts = useStore((s) => s.unreadCounts);
  const messages = useStore((s) => s.messages);

  // Sort by last_message_at desc
  const sorted = [...conversations].sort((a, b) => {
    const at = a.last_message_at ?? a.created_at;
    const bt = b.last_message_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  // Filter out conversations where the current user has been kicked / left
  const visible = sorted.filter((c) => {
    const myMembership = c.members.find((m) => m.user_id === currentUser?.id);
    // If we have no membership record at all, still show (direct chats)
    if (!myMembership) return true;
    // Hide if we have left / been kicked
    return myMembership.left_at === null;
  });

  // Filter by search
  const filtered = visible.filter((c) => {
    const name = getConversationName(c, currentUser?.id, userCache);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (filtered.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--text-secondary)",
          padding: 32,
          textAlign: "center",
        }}
      >
        <Users size={40} color="var(--text-muted)" />
        <p style={{ fontWeight: 600, fontSize: 15 }}>
          {searchQuery ? "No results found" : "No conversations yet"}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {searchQuery ? "Try a different search" : "Start a new chat with the compose button"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {filtered.map((convo) => (
        <ConvoItem
          key={convo.id}
          convo={convo}
          currentUserId={currentUser?.id ?? 0}
          userCache={userCache}
          onlineUsers={onlineUsers}
          isActive={activeConversationId === convo.id}
          unreadCount={unreadCounts[convo.id] ?? 0}
          lastMessage={messages[convo.id]?.at(-1)}
          onClick={() => router.push(`/chat/${convo.id}`)}
        />
      ))}
    </div>
  );
}

// ─── Helper: Get the name to display for a conversation ──────

function getConversationName(
  convo: Conversation,
  currentUserId: number | undefined,
  userCache: Record<number, { display_name: string; is_online?: boolean }>
): string {
  if (convo.type === "group") return convo.name ?? "Group";
  // Direct: find the other member
  const other = convo.members.find((m) => m.user_id !== currentUserId);
  if (!other) return "Unknown";
  const cached = userCache[other.user_id];
  return cached?.display_name ?? `User ${other.user_id}`;
}

function getConversationUserId(
  convo: Conversation,
  currentUserId: number | undefined
): number {
  if (convo.type === "group") return convo.created_by ?? 0;
  const other = convo.members.find((m) => m.user_id !== currentUserId);
  return other?.user_id ?? 0;
}

// ─── Individual conversation row ─────────────────────────────

interface ConvoItemProps {
  convo: Conversation;
  currentUserId: number;
  userCache: Record<number, { display_name: string; avatar_url?: string | null; is_online?: boolean }>;
  onlineUsers: Set<number>;
  isActive: boolean;
  unreadCount: number;
  lastMessage: { content: string | null; sender_id: number; created_at: string; is_deleted: boolean } | undefined;
  onClick: () => void;
}

function ConvoItem({
  convo,
  currentUserId,
  userCache,
  onlineUsers,
  isActive,
  unreadCount,
  lastMessage,
  onClick,
}: ConvoItemProps) {
  const name = getConversationName(convo, currentUserId, userCache);
  const userId = getConversationUserId(convo, currentUserId);
  const cachedUser = userCache[userId];
  const isOnline = convo.type === "direct" ? onlineUsers.has(userId) : false;

  const lastTime = formatConversationTime(
    lastMessage?.created_at ?? convo.last_message_at
  );

  let lastPreview = "";
  if (lastMessage) {
    if (lastMessage.is_deleted) {
      lastPreview = "🚫 Message deleted";
    } else if (lastMessage.content) {
      const isMine = lastMessage.sender_id === currentUserId;
      lastPreview = isMine ? `You: ${truncate(lastMessage.content, 40)}` : truncate(lastMessage.content, 40);
    }
  } else {
    lastPreview = "No messages yet";
  }

  return (
    <button
      className={`convo-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      id={`convo-item-${convo.id}`}
      style={{ width: "100%", textAlign: "left" }}
    >
      <Avatar
        userId={userId}
        displayName={convo.type === "group" ? (convo.name ?? "G") : (cachedUser?.display_name ?? name)}
        avatarUrl={convo.type === "group" ? convo.avatar_url : cachedUser?.avatar_url}
        size={48}
        isOnline={convo.type === "direct" ? isOnline : undefined}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <span
            style={{
              fontWeight: unreadCount > 0 ? 700 : 500,
              fontSize: 15,
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>
            {lastTime}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 3 }}>
          <span
            style={{
              fontSize: 14,
              color: unreadCount > 0 ? "var(--text-primary)" : "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {lastPreview}
          </span>

          {unreadCount > 0 && (
            <span
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 5px",
                flexShrink: 0,
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
