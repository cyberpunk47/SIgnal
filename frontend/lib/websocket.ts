import type { WsEvent } from "@/types";

type EventListener = (event: WsEvent) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private userId: number | null = null;

  private listeners = new Set<EventListener>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  private reconnectAttempts = 0;
  private readonly maxReconnectDelay = 10000;

  connect(userId: number) {
    if (!userId) return;

    // Already connected/connecting for this user
    if (
      this.userId === userId &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.disconnect();

    this.userId = userId;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    this.connectSocket();
  }

  private connectSocket() {
    if (!this.userId || !this.shouldReconnect) {
      return;
    }

    // Don't create another connection
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    /*
     * Production:
     *   NEXT_PUBLIC_WS_URL=wss://signal-wg4o.onrender.com
     *
     * Local:
     *   NEXT_PUBLIC_WS_URL=ws://localhost:8000
     *
     * If NEXT_PUBLIC_WS_URL is missing, automatically use the
     * current browser host.
     */
    let baseUrl = process.env.NEXT_PUBLIC_WS_URL;

    if (!baseUrl) {
      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";

      baseUrl = `${protocol}//${window.location.host}`;
    }

    baseUrl = baseUrl.replace(/\/+$/, "");

    const wsUrl = `${baseUrl}/ws/${this.userId}`;

    console.log("[WS] Connecting:", wsUrl);

    const socket = new WebSocket(wsUrl);

    this.ws = socket;

    socket.onopen = () => {
      console.log(`[WS] Connected user=${this.userId}`);

      this.reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;

        console.log("[WS] Event:", data);

        this.listeners.forEach((listener) => {
          listener(data);
        });
      } catch (error) {
        console.error("[WS] Invalid message:", event.data, error);
      }
    };

    socket.onerror = () => {
      /*
       * Browser WebSocket errors intentionally contain very little
       * information. The useful information comes from onclose.
       */
      console.error("[WS] Connection error:", socket.url);
    };

    socket.onclose = (event) => {
      console.log(
        `[WS] Closed user=${this.userId} code=${event.code} reason=${event.reason || "none"}`
      );

      if (this.ws === socket) {
        this.ws = null;
      }

      if (!this.shouldReconnect) {
        return;
      }

      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect || !this.userId) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSocket();
    }, delay);
  }

  send(data: object) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send - socket not connected");
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("[WS] Send failed:", error);
      return false;
    }
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    return this.send({
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
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Client disconnected");
      }

      this.ws = null;
    }

    this.userId = null;
    this.reconnectAttempts = 0;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager();