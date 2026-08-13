"use client";

import { useEffect } from "react";
import { useStore, type Toast } from "@/store";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const icons = {
    success: <CheckCircle size={16} color="var(--online)" />,
    error: <XCircle size={16} color="var(--text-danger)" />,
    info: <Info size={16} color="var(--accent)" />,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--bg-dropdown)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-md)",
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        animation: "toastIn 200ms ease",
        minWidth: 240,
        maxWidth: 340,
        color: "var(--text-primary)",
        fontSize: 13,
      }}
    >
      {icons[toast.type]}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          color: "var(--text-muted)",
          padding: 2,
          borderRadius: 4,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
