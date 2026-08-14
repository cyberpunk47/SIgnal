import type { WsEvent } from "@/types";

type EventListener = (event: WsEvent) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private userId: number | null = null;
  private listeners: Set<EventListener> = new Set();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  connect(userId: number) {
    // Already connected to this user
    if (
      this.userId === userId &&
      this.ws &&
      (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }

    this.disconnect();

    this.userId = userId;
    this.shouldReconnect = true;

    this._connect();
  }

  private _connect() {
    if (!this.userId || !this.shouldReconnect) {
      return;
    }

    if (
      this.ws &&
      (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      )
    ) {
      return;
    }

    const WS_BASE =
      process.env.NEXT_PUBLIC_WS_URL ||
      "ws://localhost:8000";

    const wsUrl = `${WS_BASE}/ws/${this.userId}`;

    console.log("[WS] Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);

    // IMPORTANT:
    // Store the actual socket instance.
    this.ws = ws;

    ws.onopen = () => {
      console.log(
        `[WS] Connected user ${this.userId}`
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;

        this.listeners.forEach((listener) => {
          listener(data);
        });
      } catch (error) {
        console.error(
          "[WS] Invalid event:",
          event.data,
          error
        );
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
      console.error("[WS] URL:", ws.url);
      console.error(
        "[WS] ReadyState:",
        ws.readyState
      );
    };

    ws.onclose = (event) => {
      console.log(
        `[WS] Disconnected user ${this.userId}`,
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }
      );

      // Only clear if this is still the active socket
      if (this.ws === ws) {
        this.ws = null;
      }

      if (!this.shouldReconnect) {
        return;
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this._connect();
      }, 3000);
    };
  }

  send(data: object) {
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.ws.send(JSON.stringify(data));
      return;
    }

    console.warn(
      "[WS] Cannot send - socket not connected"
    );
  }

  sendTyping(
    conversationId: number,
    isTyping: boolean
  ) {
    this.send({
      type: "typing",
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }

  subscribe(listener: EventListener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect() {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.userId = null;
  }

  get isConnected() {
    return (
      this.ws?.readyState === WebSocket.OPEN
    );
  }
}

export const wsManager =
  new WebSocketManager();