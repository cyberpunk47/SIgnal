"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import { wsManager } from "@/lib/websocket";

export function useWebSocketConnection() {
    const currentUserId = useStore((state) => state.currentUser?.id ?? null);

    useEffect(() => {
        if (!currentUserId) {
            wsManager.disconnect();
            return;
        }

        wsManager.connect(currentUserId);

        return () => {
            wsManager.disconnect();
        };
    }, [currentUserId]);
}