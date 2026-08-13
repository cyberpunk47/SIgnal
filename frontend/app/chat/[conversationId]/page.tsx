"use client";

import { useParams } from "next/navigation";
import EmptyState from "@/components/chat/EmptyState";
import ConversationView from "@/components/chat/ConversationView";

export default function ConversationPage() {
    const params = useParams<{ conversationId: string }>();
    const conversationId = Number(params.conversationId);

    if (!Number.isFinite(conversationId)) {
        return <EmptyState />;
    }

    return <ConversationView conversationId={conversationId} />;
}