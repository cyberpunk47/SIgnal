"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";

export default function RootPage() {
  const router = useRouter();
  const token = useStore((s) => s.token);
  const isAuthExpired = useStore((s) => s.isAuthExpired);
  const logout = useStore((s) => s.logout);

  useEffect(() => {
    if (token && isAuthExpired()) {
      logout();
      router.replace("/auth");
    } else if (token) {
      router.replace("/chat");
    } else {
      router.replace("/auth");
    }
  }, [token, isAuthExpired, logout, router]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}
    >
      <div className="spinner" />
    </div>
  );
}
