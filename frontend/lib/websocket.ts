import type { WsEvent } from "@/types";

type EventListener = (event: WsEvent) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private userId: number | null = null;
  private listeners: Set<EventListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  connect(userId: number) {
    if (this.userId === userId && this.ws) {
      return;
    }

    this.disconnect();

    this.userId = userId;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect() {
    if (!this.userId || !this.shouldReconnect) return;

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Use the direct backend URL for WebSocket (Next.js proxy doesn't support WS well)
    const wsUrl = `ws://localhost:8000/ws/${this.userId}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected user ${this.userId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        this.listeners.forEach((listener) => listener(data));
      } catch (error) {
        console.error("[WS] Invalid event:", event.data, error);
      }
    };

    ws.onclose = () => {
      console.log(`[WS] Disconnected user ${this.userId}`);

      if (this.ws === ws) {
        this.ws = null;
      }

      if (this.shouldReconnect) {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[WS] Cannot send - socket not connected");
    }
  }

  sendTyping(conversationId: number, isTyping: boolean) {
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

    this.ws = null;
    this.userId = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton
export const wsManager = new WebSocketManager();
