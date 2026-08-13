"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import { contactsApi, conversationsApi, usersApi } from "@/lib/api";
import type { Contact, User, Conversation } from "@/types";
import Avatar from "@/components/ui/Avatar";
import PhoneInput from "@/components/ui/PhoneInput";
import { buildFullPhoneNumber, isValidLocalPhone } from "@/lib/utils";
import { X, Search, Plus, Users, MessageCircle, ArrowLeft } from "lucide-react";

interface Props {
  onClose: () => void;
}

type Mode = "main" | "new-direct" | "new-group";

export default function NewChatModal({ onClose }: Props) {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const contacts = useStore((s) => s.contacts);
  const userCache = useStore((s) => s.userCache);
  const cacheUsers = useStore((s) => s.cacheUsers);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const setActiveConversation = useStore((s) => s.setActiveConversation);
  const addToast = useStore((s) => s.addToast);
  const addContact = useStore((s) => s.addContact);

  const [mode, setMode] = useState<Mode>("main");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  // Add contact by phone number (or username / user ID)
  const [addPhoneDigits, setAddPhoneDigits] = useState("");
  const [addUsernameQuery, setAddUsernameQuery] = useState("");
  const [addMode, setAddMode] = useState<"phone" | "username">("phone");

  // Enrich contacts with user info
  const enrichedContacts: Array<{ contact: Contact; user: User | undefined }> =
    contacts.map((c) => ({
      contact: c,
      user: userCache[c.contact_user_id],
    }));

  const filtered = enrichedContacts.filter(({ user }) => {
    if (!search) return true;
    const name = user?.display_name ?? `User ${user?.id}`;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  async function handleAddContact() {
    const identifier =
      addMode === "phone"
        ? isValidLocalPhone(addPhoneDigits)
          ? buildFullPhoneNumber(addPhoneDigits)
          : ""
        : addUsernameQuery.trim();

    if (!identifier) {
      addToast(
        addMode === "phone"
          ? "Enter a valid 10-digit phone number"
          : "Enter a username or user ID",
        "error"
      );
      return;
    }

    setLoading(true);
    try {
      const lookupRes = await usersApi.lookup(identifier);
      const targetUser: User = lookupRes.data;

      if (currentUser?.id === targetUser.id) {
        addToast("You cannot add yourself", "error");
        return;
      }

      const res = await contactsApi.add(targetUser.id);
      addContact(res.data);
      cacheUsers([targetUser]);
      addToast(`${targetUser.display_name} added to contacts!`, "success");
      setAddPhoneDigits("");
      setAddUsernameQuery("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      addToast(msg ?? "User not found", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDirect(contactUserId: number) {
    setLoading(true);
    try {
      const res = await conversationsApi.createDirect(contactUserId);
      const convo: Conversation = res.data;
      upsertConversation(convo);
      setActiveConversation(convo.id);
      router.push(`/chat/${convo.id}`);
      onClose();
    } catch {
      addToast("Failed to start conversation", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) { addToast("Group name required", "error"); return; }
    if (selectedIds.length === 0) { addToast("Select at least one member", "error"); return; }
    setLoading(true);
    try {
      const res = await conversationsApi.createGroup(groupName.trim(), selectedIds);
      const convo: Conversation = res.data;
      upsertConversation(convo);
      setActiveConversation(convo.id);
      router.push(`/chat/${convo.id}`);
      onClose();
    } catch {
      addToast("Failed to create group", "error");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(userId: number) {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 0, overflow: "hidden" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {mode !== "main" && (
            <button
              onClick={() => { setMode("main"); setSearch(""); setSelectedIds([]); setGroupName(""); }}
              className="btn-ghost"
              style={{ padding: "4px 6px" }}
              id="back-to-main-btn"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>
            {mode === "main" && "New Conversation"}
            {mode === "new-direct" && "New Message"}
            {mode === "new-group" && "New Group"}
          </h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "4px 6px" }} id="close-modal-btn">
            <X size={18} />
          </button>
        </div>

        {/* Main mode */}
        {mode === "main" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="convo-item"
              onClick={() => setMode("new-direct")}
              id="new-direct-btn"
              style={{ borderRadius: 10 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "var(--accent-muted)", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>
                <MessageCircle size={22} color="var(--accent)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>New Message</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Start a direct conversation</p>
              </div>
            </button>

            <button
              className="convo-item"
              onClick={() => setMode("new-group")}
              id="new-group-btn"
              style={{ borderRadius: 10 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "var(--accent-muted)", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>
                <Users size={22} color="var(--accent)" />
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>New Group</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Create a group conversation</p>
              </div>
            </button>

            {/* Add contact */}
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Add New Contact
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  className={addMode === "phone" ? "btn-primary" : "btn-ghost"}
                  onClick={() => setAddMode("phone")}
                  style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
                >
                  Phone
                </button>
                <button
                  type="button"
                  className={addMode === "username" ? "btn-primary" : "btn-ghost"}
                  onClick={() => setAddMode("username")}
                  style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
                >
                  Username / ID
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {addMode === "phone" ? (
                  <div style={{ flex: 1 }}>
                    <PhoneInput
                      id="add-contact-phone-input"
                      value={addPhoneDigits}
                      onChange={setAddPhoneDigits}
                    />
                  </div>
                ) : (
                  <input
                    id="add-contact-input"
                    type="text"
                    placeholder="Enter username or user ID"
                    value={addUsernameQuery}
                    onChange={(e) => setAddUsernameQuery(e.target.value)}
                    style={{ flex: 1, padding: "12px 14px", borderRadius: "var(--radius-md)" }}
                  />
                )}
                <button
                  onClick={handleAddContact}
                  disabled={loading || (addMode === "phone" ? !isValidLocalPhone(addPhoneDigits) : !addUsernameQuery.trim())}
                  className="btn-primary"
                  id="add-contact-btn"
                  style={{ width: "auto", padding: "12px 16px" }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Direct chat: pick contact */}
        {mode === "new-direct" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                className="search-input"
                type="text"
                placeholder="Search contacts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                style={{ paddingLeft: 32 }}
                id="direct-search-input"
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No contacts found. Add contacts first.
                </div>
              ) : (
                filtered.map(({ contact, user }) => (
                  <button
                    key={contact.id}
                    className="convo-item"
                    onClick={() => handleStartDirect(contact.contact_user_id)}
                    disabled={loading}
                    id={`direct-contact-${contact.contact_user_id}`}
                    style={{ width: "100%" }}
                  >
                    <Avatar
                      userId={contact.contact_user_id}
                      displayName={user?.display_name ?? `User ${contact.contact_user_id}`}
                      avatarUrl={user?.avatar_url}
                      size={40}
                    />
                    <div>
                      <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {contact.nickname || user?.display_name || `User ${contact.contact_user_id}`}
                      </p>
                      {user?.username && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>@{user.username}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Group: pick name + members */}
        {mode === "new-group" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <input
                id="group-name-input"
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 15, fontWeight: 600 }}
                autoFocus
              />
            </div>

            {selectedIds.length > 0 && (
              <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--accent)" }}>
                {selectedIds.length} member{selectedIds.length > 1 ? "s" : ""} selected
              </div>
            )}

            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {enrichedContacts.map(({ contact, user }) => {
                const uid = contact.contact_user_id;
                const checked = selectedIds.includes(uid);
                return (
                  <button
                    key={contact.id}
                    className="convo-item"
                    onClick={() => toggleSelect(uid)}
                    id={`group-member-${uid}`}
                    style={{ width: "100%", opacity: 1 }}
                  >
                    <Avatar
                      userId={uid}
                      displayName={user?.display_name ?? `User ${uid}`}
                      avatarUrl={user?.avatar_url}
                      size={40}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                        {contact.nickname || user?.display_name || `User ${uid}`}
                      </p>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `2px solid ${checked ? "var(--accent)" : "var(--border-medium)"}`,
                        background: checked ? "var(--accent)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 150ms ease",
                      }}
                    >
                      {checked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <button
                className="btn-primary"
                onClick={handleCreateGroup}
                disabled={loading || !groupName.trim() || selectedIds.length === 0}
                id="create-group-btn"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {loading ? <div className="spinner" /> : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
