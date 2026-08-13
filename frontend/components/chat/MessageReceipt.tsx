"use client";

import { Check, CheckCheck } from "lucide-react";

export type ReceiptStatus = "sending" | "sent" | "delivered" | "read";

type Props = {
  status: ReceiptStatus;
};

export default function MessageReceipt({ status }: Props) {
  const isDouble = status === "delivered" || status === "read";

  return (
    <span
      className={`message-receipt message-receipt--${status}`}
      aria-label={`Message ${status}`}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    >
      {isDouble ? <CheckCheck size={16} strokeWidth={2.25} /> : <Check size={16} strokeWidth={2.25} />}
    </span>
  );
}
