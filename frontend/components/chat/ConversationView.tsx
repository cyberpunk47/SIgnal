"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Eye, Info, Send, UserPlus } from "lucide-react";
import { useStore } from "@/store";
import { contactsApi, conversationsApi, messagesApi, usersApi } from "@/lib/api";
import { wsManager } from "@/lib/websocket";
import {
    formatDateSeparator,
    formatMessageTime,
    isSameDay,
    formatLastSeen,
    generateTempId,
} from "@/lib/utils";
import type { Message, MessageStatusRecord } from "@/types";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/chat/EmptyState";
import MessageReceipt, { type ReceiptStatus } from "@/components/chat/MessageReceipt";
import GroupInfoModal from "@/components/modals/GroupInfoModal";

type Props = {
    conversationId: number;
};

type MessageRow = {
    kind: "message";
    message: Message;
    showDate: boolean;
} | {
    kind: "separator";
    id: string;
    label: string;
};

export default function ConversationView({ conversationId }: Props) {
    const router = useRouter();
    const currentUser = useStore((s) => s.currentUser);
    const conversations = useStore((s) => s.conversations);
    const messages = useStore((s) => s.messages);
    const contacts = useStore((s) => s.contacts);
    const userCache = useStore((s) => s.userCache);
    const setMessages = useStore((s) => s.setMessages);
    const setConversations = useStore((s) => s.setConversations);
    const appendMessage = useStore((s) => s.appendMessage);
    const replaceTempMessage = useStore((s) => s.replaceTempMessage);
    const setActiveConversation = useStore((s) => s.setActiveConversation);
    const clearUnread = useStore((s) => s.clearUnread);
    const cacheUsers = useStore((s) => s.cacheUsers);
    const addContact = useStore((s) => s.addContact);
    const onlineUsers = useStore((s) => s.onlineUsers);
    const addToast = useStore((s) => s.addToast);
    const typingUsers = useStore((s) => s.typingUsers);

    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [addingContact, setAddingContact] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [receiptMessage, setReceiptMessage] = useState<Message | null>(null);
    const [receiptRows, setReceiptRows] = useState<MessageStatusRecord[]>([]);
    const [receiptsLoading, setReceiptsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const lastMarkedReadMessageId = useRef<number | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const conversation = useMemo(
        () => conversations.find((item) => item.id === conversationId),
        [conversations, conversationId]
    );

    const conversationMessages = useMemo(
        () => messages[conversationId] ?? [],
        [messages, conversationId]
    );

    const directOtherId = useMemo(() => {
        if (!conversation || conversation.type !== "direct") return null;

        const other = conversation.members.find((member) => member.user_id !== currentUser?.id);
        return other?.user_id ?? null;
    }, [conversation, currentUser]);

    const directOtherUser = directOtherId ? userCache[directOtherId] : undefined;
    const isDirectContact = directOtherId !== null && contacts.some((contact) => contact.contact_user_id === directOtherId);

    function getDirectPresence() {
        if (!directOtherId) {
            return { isOnline: false, label: "" };
        }

        const liveOnline = onlineUsers.has(directOtherId);
        const cachedUser = userCache[directOtherId];

        if (liveOnline) {
            return { isOnline: true, label: "Online" };
        }

        if (cachedUser?.last_seen_at) {
            return {
                isOnline: false,
                label: formatLastSeen(cachedUser.last_seen_at),
            };
        }

        return {
            isOnline: false,
            label: "Offline",
        };
    }

    useEffect(() => {
        setActiveConversation(conversationId);
        clearUnread(conversationId);
    }, [conversationId, clearUnread, setActiveConversation]);

    useEffect(() => {
        if (!directOtherId || directOtherUser) return;

        let cancelled = false;

        async function hydrateOtherUser() {
            try {
                const res = await usersApi.lookup(String(directOtherId));
                if (cancelled) return;
                cacheUsers([res.data]);
            } catch {
                // ignore; the view can still fall back to the numeric user id
            }
        }

        hydrateOtherUser();

        return () => {
            cancelled = true;
        };
    }, [cacheUsers, directOtherId, directOtherUser]);

    useEffect(() => {
        let cancelled = false;

        async function loadMessages() {
            setLoading(true);
            setError("");

            try {
                const res = await messagesApi.list(conversationId, { limit: 100 });
                if (cancelled) return;

                const ordered = [...res.data].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );

                setMessages(conversationId, ordered);
                if (ordered.length > 0) {
                    clearUnread(conversationId);
                }
            } catch {
                if (!cancelled) {
                    setError("Unable to load this conversation.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadMessages();

        return () => {
            cancelled = true;
        };
    }, [conversationId, clearUnread, setMessages]);

    useEffect(() => {
        const latestMessage = conversationMessages.at(-1);

        if (!conversation || !currentUser || !latestMessage) return;
        const latestMessageId = latestMessage.id;

        if (latestMessage.sender_id === currentUser.id) return;
        if (lastMarkedReadMessageId.current === latestMessageId) return;

        lastMarkedReadMessageId.current = latestMessageId;

        let cancelled = false;

        async function markLatestAsRead() {
            try {
                await messagesApi.markRead(conversationId, latestMessageId);
                if (cancelled) return;

                const convRes = await conversationsApi.list();
                if (!cancelled) {
                    setConversations(convRes.data);
                }
            } catch {
                // ignore read failures; chat still renders normally
            }
        }

        markLatestAsRead();

        return () => {
            cancelled = true;
        };
    }, [conversation, conversationId, conversationMessages, currentUser, setConversations]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [conversationMessages.length]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            wsManager.sendTyping(conversationId, false);
        };
    }, [conversationId]);

    function getConversationTitle(): string {
        if (!conversation) return `Conversation ${conversationId}`;
        if (conversation.type === "group") return conversation.name ?? "Group";

        const other = conversation.members.find((member) => member.user_id !== currentUser?.id);
        if (!other) return "Direct message";

        return userCache[other.user_id]?.display_name ?? `User ${other.user_id}`;
    }

    function getConversationSubtitle(): string {
        if (!conversation || conversation.type === "group") {
            return conversation?.type === "group"
                ? `${conversation.members.length} members`
                : "Loading conversation details";
        }

        const other = conversation.members.find((member) => member.user_id !== currentUser?.id);
        if (!other) return "";

        const cachedUser = userCache[other.user_id];
        if (!cachedUser) return `User ${other.user_id}`;

        return getDirectPresence().label;
    }

    function getConversationUserId(): number | null {
        if (!conversation || conversation.type !== "direct") return null;
        const other = conversation.members.find((member) => member.user_id !== currentUser?.id);
        return other?.user_id ?? null;
    }

    function getMessageStatus(message: Message): ReceiptStatus | null {
        if (!conversation || message.sender_id !== currentUser?.id) return null;
        if (message.id < 0) return "sending";

        if (conversation.type === "direct") {
            const otherId = getConversationUserId();
            if (!otherId) return "sent";

            const otherMember = conversation.members.find((member) => member.user_id === otherId);
            if (otherMember?.last_read_message_id && otherMember.last_read_message_id >= message.id) {
                return "read";
            }

            const otherIsOnline = onlineUsers.has(otherId) || Boolean(userCache[otherId]?.is_online);
            return otherIsOnline ? "delivered" : "sent";
        }

        const otherMembers = conversation.members.filter((member) => member.user_id !== currentUser?.id && member.left_at === null);

        if (otherMembers.length === 0) return "sent";

        const everyoneRead = otherMembers.every(
            (member) => (member.last_read_message_id ?? 0) >= message.id
        );

        if (everyoneRead) return "read";

        const someoneOnline = otherMembers.some(
            (member) => onlineUsers.has(member.user_id) || Boolean(userCache[member.user_id]?.is_online)
        );

        return someoneOnline ? "delivered" : "sent";
    }

    async function openReceipts(message: Message) {
        if (message.sender_id !== currentUser?.id || message.id < 0) return;

        setReceiptMessage(message);
        setReceiptsLoading(true);
        setReceiptRows([]);

        try {
            const res = await messagesApi.receipts(message.id);
            setReceiptRows(res.data);
        } catch {
            addToast("Unable to load read receipts", "error");
        } finally {
            setReceiptsLoading(false);
        }
    }

    async function handleAddContact() {
        const otherId = getConversationUserId();

        if (!otherId) return;

        setAddingContact(true);

        try {
            const user = directOtherUser ?? (await usersApi.lookup(String(otherId))).data;
            const alreadyContact = contacts.some((contact) => contact.contact_user_id === user.id);

            if (alreadyContact) {
                addToast("User is already in contacts", "info");
                return;
            }

            const res = await contactsApi.add(user.id);
            addContact(res.data);
            cacheUsers([user]);
            addToast(`${user.display_name} added to contacts`, "success");
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            addToast(msg ?? "Failed to add contact", "error");
        } finally {
            setAddingContact(false);
        }
    }

    function getConversationAvatar(): { userId: number; displayName: string; avatarUrl?: string | null } {
        if (!conversation) {
            return { userId: conversationId, displayName: "Chat" };
        }

        if (conversation.type === "group") {
            return {
                userId: conversation.id,
                displayName: conversation.name ?? "Group",
                avatarUrl: conversation.avatar_url,
            };
        }

        const other = conversation.members.find((member) => member.user_id !== currentUser?.id);
        const cachedUser = other ? userCache[other.user_id] : undefined;

        return {
            userId: other?.user_id ?? conversation.id,
            displayName: cachedUser?.display_name ?? `User ${other?.user_id ?? conversation.id}`,
            avatarUrl: cachedUser?.avatar_url,
        };
    }

    async function submitDraft() {
        const content = draft.trim();
        if (!content || sending) return;

        setSending(true);
        setError("");

        const tempId = generateTempId();
        const now = new Date().toISOString();
        const optimistic: Message = {
            id: -Date.now(),
            conversation_id: conversationId,
            sender_id: currentUser?.id ?? 0,
            content,
            message_type: "text",
            reply_to_message_id: null,
            client_temp_id: tempId,
            is_deleted: false,
            created_at: now,
        };

        setDraft("");
        appendMessage(conversationId, optimistic);

        try {
            const res = await messagesApi.send(conversationId, {
                content,
                message_type: "text",
                client_temp_id: tempId,
            });

            replaceTempMessage(conversationId, tempId, res.data);
        } catch {
            setMessages(
                conversationId,
                (messages[conversationId] ?? []).filter((message) => message.client_temp_id !== tempId)
            );
            setDraft(content);
            setError("Failed to send message.");
            addToast("Failed to send message", "error");
        } finally {
            setSending(false);
        }
    }

    async function handleSendMessage(event: React.FormEvent) {
        event.preventDefault();
        await submitDraft();
    }

    function handleDraftChange(value: string) {
        setDraft(value);
        wsManager.sendTyping(conversationId, value.trim().length > 0);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            wsManager.sendTyping(conversationId, false);
        }, 1200);
    }

    const rows = useMemo<MessageRow[]>(() => {
        const items: MessageRow[] = [];

        conversationMessages.forEach((message, index) => {
            const previous = conversationMessages[index - 1];
            const showDate = !previous || !isSameDay(previous.created_at, message.created_at);

            if (showDate) {
                items.push({
                    kind: "separator",
                    id: `date-${message.id}`,
                    label: formatDateSeparator(message.created_at),
                });
            }

            items.push({
                kind: "message",
                message,
                showDate,
            });
        });

        return items;
    }, [conversationMessages]);

    if (!conversation && !loading) {
        return (
            <div className="signal-chat-pane">
                <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)" }}>
                    <button className="btn-ghost" onClick={() => router.push("/chat")} style={{ width: "auto" }}>
                        <ArrowLeft size={16} /> Back to chats
                    </button>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <EmptyState />
                </div>
            </div>
        );
    }

    if (loading && conversationMessages.length === 0) {
        return (
            <div className="signal-chat-pane" style={{ justifyContent: "center", alignItems: "center" }}>
                <div className="spinner" />
            </div>
        );
    }

    const avatar = getConversationAvatar();
    const directPresence = conversation?.type === "direct" ? getDirectPresence() : null;
    const visibleTypingUsers = (typingUsers[conversationId] ? [...typingUsers[conversationId]] : [])
        .filter((userId) => userId !== currentUser?.id)
        .map((userId) => userCache[userId]?.display_name ?? `User ${userId}`);

    return (
        <div className="signal-chat-pane">
            <header
                style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: "rgba(12,16,24,0.88)",
                    backdropFilter: "blur(16px)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <button className="btn-ghost" onClick={() => router.push("/chat")} style={{ width: "auto" }}>
                        <ArrowLeft size={16} />
                    </button>
                    <Avatar
                        userId={avatar.userId}
                        displayName={avatar.displayName}
                        avatarUrl={avatar.avatarUrl}
                        size={42}
                        isOnline={conversation?.type === "direct" ? directPresence?.isOnline : undefined}
                    />
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getConversationTitle()}
                        </h1>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{getConversationSubtitle()}</p>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {conversation?.type === "direct" && directOtherId !== null && !isDirectContact && (
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={handleAddContact}
                            disabled={addingContact}
                            style={{ width: "auto", display: "flex", alignItems: "center", gap: 8 }}
                        >
                            {addingContact ? <div className="spinner" /> : <UserPlus size={16} />}
                            Add to Contacts
                        </button>
                    )}

                    {conversation?.type === "group" && (
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setShowGroupInfo(true)}
                            style={{ width: "auto", display: "flex", alignItems: "center", gap: 8 }}
                            aria-label="Open group info"
                        >
                            <Info size={18} />
                            Group Info
                        </button>
                    )}
                </div>
            </header>

            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {error && (
                    <div style={{ alignSelf: "center", color: "var(--text-danger)", fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {rows.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <EmptyState />
                    </div>
                ) : (
                    rows.map((row) => {
                        if (row.kind === "separator") {
                            return (
                                <div key={row.id} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                                    <span
                                        style={{
                                            padding: "6px 12px",
                                            borderRadius: 999,
                                            background: "var(--bg-secondary)",
                                            color: "var(--text-muted)",
                                            fontSize: 12,
                                            border: "1px solid var(--border-subtle)",
                                        }}
                                    >
                                        {row.label}
                                    </span>
                                </div>
                            );
                        }

                        const message = row.message;
                        const isMine = message.sender_id === currentUser?.id;
                        const sender = userCache[message.sender_id];
                        const receiptStatus = getMessageStatus(message);

                        return (
                            <div
                                key={message.client_temp_id ?? message.id}
                                style={{
                                    display: "flex",
                                    justifyContent: isMine ? "flex-end" : "flex-start",
                                }}
                            >
                                <div
                                    className={isMine ? "bubble-sent" : "bubble-received"}
                                    style={{
                                        maxWidth: "min(680px, 78%)",
                                        padding: "10px 14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                    }}
                                >
                                    {!isMine && conversation?.type === "group" && (
                                        <p className="bubble-sender-name">
                                            {sender?.display_name ?? `User ${message.sender_id}`}
                                        </p>
                                    )}

                                    {message.is_deleted ? (
                                        <p className="bubble-deleted" style={{ margin: 0, fontSize: 16 }}>
                                            Message deleted
                                        </p>
                                    ) : (
                                        <p className="bubble-content">
                                            {message.content}
                                        </p>
                                    )}

                                    <div className="bubble-meta">
                                        <span className="bubble-time">
                                            {formatMessageTime(message.created_at)}
                                        </span>

                                        {receiptStatus && (
                                            <button
                                                type="button"
                                                className="receipt-button"
                                                onClick={() => openReceipts(message)}
                                                title="View read receipts"
                                                aria-label="View read receipts"
                                            >
                                                <MessageReceipt status={receiptStatus} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {visibleTypingUsers.length > 0 && (
                <div style={{ padding: "0 24px 10px", color: "var(--accent)", fontSize: 14, fontWeight: 600 }}>
                    {visibleTypingUsers.slice(0, 2).join(", ")} {visibleTypingUsers.length === 1 ? "is" : "are"} typing...
                </div>
            )}

            <form
                onSubmit={handleSendMessage}
                style={{
                    padding: 16,
                    borderTop: "1px solid var(--border-subtle)",
                    background: "rgba(10,14,22,0.95)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 12,
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 18,
                        padding: 12,
                    }}
                >
                    <textarea
                        value={draft}
                        onChange={(e) => handleDraftChange(e.target.value)}
                        placeholder="Write a message"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void submitDraft();
                            }
                        }}
                        style={{
                            flex: 1,
                            resize: "none",
                            border: 0,
                            outline: 0,
                            background: "transparent",
                            color: "var(--text-primary)",
                            fontSize: 16,
                            lineHeight: 1.5,
                            maxHeight: 140,
                            minHeight: 24,
                        }}
                    />
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={sending || !draft.trim()}
                        style={{ width: "auto", minWidth: 44, height: 44, borderRadius: 14, padding: "0 14px" }}
                        aria-label="Send message"
                    >
                        {sending ? <div className="spinner" /> : <Send size={16} />}
                    </button>
                </div>
            </form>

            {showGroupInfo && conversation?.type === "group" && (
                <GroupInfoModal conversation={conversation} onClose={() => setShowGroupInfo(false)} />
            )}

            {receiptMessage && (
                <div className="modal-overlay" onClick={() => setReceiptMessage(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: "hidden", maxWidth: 440 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
                            <div>
                                <h3 style={{ fontSize: 17, fontWeight: 700 }}>Message Info</h3>
                                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
                                    Sent {formatMessageTime(receiptMessage.created_at)}
                                </p>
                            </div>
                            <Eye size={18} color="var(--accent)" />
                        </div>

                        <div style={{ padding: 16 }}>
                            <div className="bubble-sent" style={{ padding: "10px 14px", marginBottom: 16 }}>
                                <p className="bubble-content">{receiptMessage.content}</p>
                            </div>

                            {receiptsLoading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                                    <div className="spinner" />
                                </div>
                            ) : receiptRows.length === 0 ? (
                                <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: 20 }}>
                                    No recipient receipts yet.
                                </p>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {receiptRows.map((row) => {
                                        const user = userCache[row.user_id];
                                        const read = row.status === "read";
                                        const delivered = row.status === "delivered";

                                        return (
                                            <div key={`${row.message_id}-${row.user_id}`} className="convo-item" style={{ borderRadius: 10, padding: "10px 12px" }}>
                                                <Avatar
                                                    userId={row.user_id}
                                                    displayName={user?.display_name ?? `User ${row.user_id}`}
                                                    avatarUrl={user?.avatar_url}
                                                    size={38}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                                                        {user?.display_name ?? `User ${row.user_id}`}
                                                    </p>
                                                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                                        {new Date(row.updated_at).toLocaleString()}
                                                    </p>
                                                </div>
                                                <span className={`receipt-pill receipt-pill--${row.status}`}>
                                                    {read ? <CheckCircle2 size={14} /> : delivered ? <MessageReceipt status="delivered" /> : <Clock3 size={14} />}
                                                    {read ? "Read" : delivered ? "Delivered" : "Sent"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
