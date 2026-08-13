"use client";

import { Lock } from "lucide-react";

export default function EmptyState() {
  return (
    <div
      className="signal-chat-pane"
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "var(--text-secondary)",
        textAlign: "center",
        padding: 48,
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Lock size={40} color="var(--text-muted)" />
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 600, color: "var(--text-primary)" }}>
        Select a conversation
      </h2>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 340, lineHeight: 1.6 }}>
        Your messages are end-to-end encrypted. Click on a chat to start messaging.
      </p>
      <div
        style={{
          marginTop: 8,
          padding: "10px 18px",
          background: "var(--bg-secondary)",
          borderRadius: 20,
          fontSize: 13,
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Lock size={14} />
        End-to-end encrypted
      </div>
    </div>
  );
}
