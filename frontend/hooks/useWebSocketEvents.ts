"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import { conversationsApi } from "@/lib/api";
import { wsManager } from "@/lib/websocket";
import type { WsEvent } from "@/types";

export function useWebSocketEvents() {
    const appendMessage = useStore((state) => state.appendMessage);
    const setTyping = useStore((state) => state.setTyping);
    const updateUserPresence = useStore((state) => state.updateUserPresence);
    const updateConversationReadReceipt = useStore((state) => state.updateConversationReadReceipt);
    const markMessageDelivered = useStore((state) => state.markMessageDelivered);
    const activeConversationId = useStore((state) => state.activeConversationId);
    const incrementUnread = useStore((state) => state.incrementUnread);
    const clearUnread = useStore((state) => state.clearUnread);
    const currentUserId = useStore((state) => state.currentUser?.id ?? null);
    const setConversations = useStore((state) => state.setConversations);

    useEffect(() => {
        const unsubscribe = wsManager.subscribe((event: WsEvent) => {
            switch (event.type) {
                case "user_online": {
                    updateUserPresence(event.user_id, true, null);
                    break;
                }
                case "user_offline": {
                    updateUserPresence(event.user_id, false, event.last_seen_at);
                    break;
                }
                case "typing": {
                    setTyping(event.conversation_id, event.user_id, event.is_typing);
                    break;
                }
                case "new_message": {
                    const message = event.message;
                    appendMessage(message.conversation_id, message);

                    if (currentUserId && message.sender_id !== currentUserId) {
                        if (activeConversationId === message.conversation_id) {
                            clearUnread(message.conversation_id);
                        } else {
                            incrementUnread(message.conversation_id);
                        }
                    }

                    conversationsApi.list().then((response) => setConversations(response.data)).catch(() => { });
                    break;
                }
                case "message_read": {
                    updateConversationReadReceipt(event.message_id, event.user_id);
                    break;
                }
                case "message_delivered": {
                    markMessageDelivered(event.message_id, event.user_id);
                    break;
                }
                case "member_added":
                case "member_removed": {
                    // Refresh conversation list so membership changes reflect immediately
                    conversationsApi.list().then((response) => setConversations(response.data)).catch(() => { });
                    break;
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [
        appendMessage,
        clearUnread,
        activeConversationId,
        currentUserId,
        incrementUnread,
        setConversations,
        setTyping,
        updateConversationReadReceipt,
        markMessageDelivered,
        updateUserPresence,
    ]);
}