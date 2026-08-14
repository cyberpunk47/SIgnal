"use client";

import { Check, CheckCheck } from "lucide-react";

export type ReceiptStatus = "sending" | "sent" | "delivered" | "read";

type Props = {
  status: ReceiptStatus;
};

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  sending: "rgba(255,255,255,0.45)",
  sent: "rgba(255,255,255,0.55)",
  delivered: "rgba(255,255,255,0.85)",
  read: "#ffffff",
};

export default function MessageReceipt({ status }: Props) {
  const isDouble = status === "delivered" || status === "read";
  const color = STATUS_COLORS[status];

  return (
    <span
      className={`message-receipt message-receipt--${status}`}
      aria-label={`Message ${status}`}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color,
        // Prevent blur from fractional pixel rendering
        transform: "translateZ(0)",
      }}
    >
      {isDouble ? (
        <CheckCheck size={15} strokeWidth={2} />
      ) : (
        <Check size={15} strokeWidth={2} />
      )}
    </span>
  );
}
