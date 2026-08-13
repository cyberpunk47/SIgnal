"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, LogOut, UserMinus, UserPlus, X } from "lucide-react";
import { useStore } from "@/store";
import { conversationsApi, usersApi } from "@/lib/api";
import type { Contact, Conversation, User } from "@/types";
import Avatar from "@/components/ui/Avatar";

type Props = {
  conversation: Conversation;
  onClose: () => void;
};

export default function GroupInfoModal({ conversation, onClose }: Props) {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const contacts = useStore((s) => s.contacts);
  const userCache = useStore((s) => s.userCache);
  const cacheUsers = useStore((s) => s.cacheUsers);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const setConversations = useStore((s) => s.setConversations);
  const addToast = useStore((s) => s.addToast);

  const [loading, setLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);

  const activeMembers = useMemo(
    () => conversation.members.filter((m) => m.left_at === null),
    [conversation.members]
  );

  const currentMember = activeMembers.find((m) => m.user_id === currentUser?.id);
  const isAdmin = currentMember?.role === "admin";

  const memberIds = new Set(activeMembers.map((m) => m.user_id));

  const addableContacts: Array<{ contact: Contact; user: User | undefined }> = contacts
    .filter((c) => !memberIds.has(c.contact_user_id))
    .map((c) => ({ contact: c, user: userCache[c.contact_user_id] }));

  useEffect(() => {
    const missingIds = activeMembers
      .map((m) => m.user_id)
      .filter((id) => !userCache[id]);

    if (missingIds.length === 0) return;

    let cancelled = false;

    async function hydrateMembers() {
      const users: User[] = [];
      for (const id of missingIds) {
        try {
          const res = await usersApi.lookup(String(id));
          users.push(res.data);
        } catch {
          // skip unknown users
        }
      }
      if (!cancelled && users.length > 0) {
        cacheUsers(users);
      }
    }

    hydrateMembers();

    return () => {
      cancelled = true;
    };
  }, [activeMembers, cacheUsers, userCache]);

  async function refreshConversation() {
    const res = await conversationsApi.list();
    const conversations = res.data as Conversation[];
    setConversations(conversations);
    const updated = conversations.find((c) => c.id === conversation.id);
    if (updated) upsertConversation(updated);
  }

  async function handleAddMember(userId: number) {
    setAddingUserId(userId);
    setLoading(true);
    try {
      await conversationsApi.addMember(conversation.id, userId);
      await refreshConversation();
      addToast("Member added to group", "success");
      setShowAddMember(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast(msg ?? "Failed to add member", "error");
    } finally {
      setLoading(false);
      setAddingUserId(null);
    }
  }

  async function handleRemoveMember(userId: number) {
    setLoading(true);
    try {
      await conversationsApi.removeMember(conversation.id, userId);
      await refreshConversation();
      addToast("Member removed from group", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast(msg ?? "Failed to remove member", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeRole(userId: number, role: "admin" | "member") {
    setLoading(true);
    try {
      await conversationsApi.changeMemberRole(conversation.id, userId, role);
      await refreshConversation();
      addToast(role === "admin" ? "Member promoted to admin" : "Admin changed to member", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast(msg ?? "Failed to update role", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveGroup() {
    setLoading(true);
    try {
      await conversationsApi.leave(conversation.id);
      await refreshConversation();
      addToast("You left the group", "info");
      onClose();
      router.push("/chat");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast(msg ?? "Failed to leave group", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 0, overflow: "hidden", maxWidth: 480 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>Group Info</h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "4px 6px" }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px 20px 12px", textAlign: "center", borderBottom: "1px solid var(--border-subtle)" }}>
          <Avatar
            userId={conversation.id}
            displayName={conversation.name ?? "Group"}
            avatarUrl={conversation.avatar_url}
            size={72}
          />
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12, color: "var(--text-primary)" }}>
            {conversation.name ?? "Group"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ padding: "12px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Members
          </span>
          {isAdmin && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setShowAddMember((v) => !v)}
              style={{ width: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 10px" }}
            >
              <UserPlus size={14} />
              Add
            </button>
          )}
        </div>

        {showAddMember && isAdmin && (
          <div style={{ padding: "0 12px 12px", maxHeight: 180, overflowY: "auto" }}>
            {addableContacts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 4px" }}>
                No contacts available to add. Add contacts first.
              </p>
            ) : (
              addableContacts.map(({ contact, user }) => (
                <button
                  key={contact.id}
                  type="button"
                  className="convo-item"
                  onClick={() => handleAddMember(contact.contact_user_id)}
                  disabled={loading}
                  style={{ width: "100%", borderRadius: 10 }}
                >
                  <Avatar
                    userId={contact.contact_user_id}
                    displayName={user?.display_name ?? `User ${contact.contact_user_id}`}
                    avatarUrl={user?.avatar_url}
                    size={36}
                  />
                  <span style={{ flex: 1, textAlign: "left", fontWeight: 500 }}>
                    {contact.nickname || user?.display_name || `User ${contact.contact_user_id}`}
                  </span>
                  {addingUserId === contact.contact_user_id ? (
                    <div className="spinner" />
                  ) : (
                    <UserPlus size={16} color="var(--accent)" />
                  )}
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ maxHeight: 280, overflowY: "auto", padding: "0 8px" }}>
          {activeMembers.map((member) => {
            const user = userCache[member.user_id];
            const isSelf = member.user_id === currentUser?.id;

            return (
              <div
                key={member.user_id}
                className="convo-item"
                style={{ borderRadius: 10 }}
              >
                <Avatar
                  userId={member.user_id}
                  displayName={user?.display_name ?? `User ${member.user_id}`}
                  avatarUrl={user?.avatar_url}
                  size={40}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user?.display_name ?? `User ${member.user_id}`}
                    {isSelf && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> (You)</span>}
                  </p>
                  {member.role === "admin" && (
                    <p style={{ fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Crown size={11} /> Admin
                    </p>
                  )}
                </div>

                {isAdmin && !isSelf && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleChangeRole(member.user_id, member.role === "admin" ? "member" : "admin")}
                      disabled={loading}
                      style={{ width: "auto", padding: "7px 9px", fontSize: 12, color: member.role === "admin" ? "var(--text-secondary)" : "var(--accent)" }}
                    >
                      {member.role === "admin" ? "Demote" : "Promote"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={loading}
                      style={{ padding: 8, color: "var(--text-danger)" }}
                      aria-label="Remove member"
                    >
                      <UserMinus size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <button
            type="button"
            className="btn-danger"
            onClick={handleLeaveGroup}
            disabled={loading}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {loading ? <div className="spinner" /> : <><LogOut size={16} /> Leave Group</>}
          </button>
        </div>
      </div>
    </div>
  );
}
