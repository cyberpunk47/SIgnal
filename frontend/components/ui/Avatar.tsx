"use client";

import { getInitials, getAvatarColor } from "@/lib/utils";
import Image from "next/image";

interface AvatarProps {
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  isOnline?: boolean;
}

export default function Avatar({
  userId,
  displayName,
  avatarUrl,
  size = 40,
  isOnline,
}: AvatarProps) {
  const initials = getInitials(displayName);
  const color = getAvatarColor(userId);

  return (
    <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
          }}
          onError={(e) => {
            // fallback handled by showing initials below
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          aria-label={displayName}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: size * 0.42,
            color: "#fff",
            flexShrink: 0,
            userSelect: "none",
            textRendering: "geometricPrecision",
          }}
        >
          {initials}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            right: 1,
            width: size * 0.24,
            height: size * 0.24,
            borderRadius: "50%",
            background: isOnline ? "var(--online)" : "var(--text-muted)",
            border: "2px solid var(--bg-primary)",
          }}
        />
      )}
    </div>
  );
}
