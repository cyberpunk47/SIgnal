"use client";

import { useRouter } from "next/navigation";
import { LogOut, Phone, User, X } from "lucide-react";
import { useStore } from "@/store";
import Avatar from "@/components/ui/Avatar";

interface Props {
    onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
    const router = useRouter();
    const currentUser = useStore((s) => s.currentUser);
    const logout = useStore((s) => s.logout);

    function handleLogout() {
        logout();
        onClose();
        router.replace("/auth");
    }

    if (!currentUser) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
                style={{ width: "100%", maxWidth: 420, padding: 0, overflow: "hidden" }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-subtle)",
                    }}
                >
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>Settings</h3>
                    <button className="btn-ghost" onClick={onClose} style={{ padding: 6 }} aria-label="Close settings">
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <Avatar
                            userId={currentUser.id}
                            displayName={currentUser.display_name}
                            avatarUrl={currentUser.avatar_url}
                            size={56}
                        />
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                                {currentUser.display_name}
                            </p>
                            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                @{currentUser.username}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <InfoRow icon={<User size={16} />} label="Username" value={currentUser.username} />
                        <InfoRow icon={<Phone size={16} />} label="Phone" value={currentUser.phone_number ?? "Not set"} />
                    </div>

                    <button
                        type="button"
                        className="btn-danger"
                        onClick={handleLogout}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
            }}
        >
            <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>{icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                    {label}
                </p>
                <p style={{ fontSize: 15, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {value}
                </p>
            </div>
        </div>
    );
}
