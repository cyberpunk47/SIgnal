"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import {
  MessageCircle,
  Phone,
  Radio,
  Settings,
  Edit,
  LogOut,
  Search,
} from "lucide-react";
import ConversationList from "./ConversationList";
import NewChatModal from "./NewChatModal";
import SettingsModal from "@/components/modals/SettingsModal";
import Avatar from "@/components/ui/Avatar";

type NavTab = "chats" | "calls" | "stories";

export default function Sidebar() {
  const router = useRouter();
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<NavTab>("chats");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");

  function handleLogout() {
    logout();
    router.replace("/auth");
  }

  return (
    <>
      {/* Icon rail */}
      <nav
        className="signal-icon-rail"
        aria-label="Navigation"
        style={{ justifyContent: "space-between" }}
      >
        {/* Top: nav + compose */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* Current user avatar */}
          {currentUser && (
            <button
              onClick={() => setShowSettings(true)}
              style={{ marginBottom: 8 }}
              title={currentUser.display_name}
              id="settings-avatar-btn"
            >
              <Avatar
                userId={currentUser.id}
                displayName={currentUser.display_name}
                avatarUrl={currentUser.avatar_url}
                size={36}
              />
            </button>
          )}

          <button
            className={`rail-btn ${activeTab === "chats" ? "active" : ""}`}
            onClick={() => setActiveTab("chats")}
            title="Chats"
            id="nav-chats-btn"
          >
            <MessageCircle size={22} />
          </button>
          <button
            className={`rail-btn ${activeTab === "calls" ? "active" : ""}`}
            onClick={() => setActiveTab("calls")}
            title="Calls"
            id="nav-calls-btn"
          >
            <Phone size={22} />
          </button>
          <button
            className={`rail-btn ${activeTab === "stories" ? "active" : ""}`}
            onClick={() => setActiveTab("stories")}
            title="Stories"
            id="nav-stories-btn"
          >
            <Radio size={22} />
          </button>
        </div>

        {/* Bottom: settings + logout */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <button
            className="rail-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
            id="settings-btn"
          >
            <Settings size={22} />
          </button>
          <button
            className="rail-btn"
            onClick={handleLogout}
            title="Sign Out"
            id="logout-btn"
            style={{ color: "var(--text-danger)" }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Conversation panel */}
      <div className="signal-convo-panel">
        {/* Panel header */}
        <div
          style={{
            padding: "16px 16px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            {activeTab === "chats" && "Chats"}
            {activeTab === "calls" && "Calls"}
            {activeTab === "stories" && "Stories"}
          </h2>
          {activeTab === "chats" && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="rail-btn"
                style={{ width: 36, height: 36 }}
                onClick={() => setShowNewChat(true)}
                title="New Chat"
                id="new-chat-btn"
              >
                <Edit size={18} />
              </button>
              <button
                className="rail-btn"
                style={{ width: 36, height: 36 }}
                title="Search"
                id="sidebar-search-btn"
              >
                <Search size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Search bar */}
        {activeTab === "chats" && (
          <div className="search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              id="conversation-search"
              className="search-input"
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Content */}
        {activeTab === "chats" && (
          <ConversationList searchQuery={search} />
        )}

        {activeTab === "calls" && (
          <PlaceholderPanel
            icon={<Phone size={40} color="var(--text-muted)" />}
            title="No recent calls"
            subtitle="Voice and video calls coming soon"
          />
        )}

        {activeTab === "stories" && (
          <PlaceholderPanel
            icon={<Radio size={40} color="var(--text-muted)" />}
            title="No stories"
            subtitle="Stories feature coming soon"
          />
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

function PlaceholderPanel({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "var(--text-secondary)",
        padding: 32,
        textAlign: "center",
      }}
    >
      {icon}
      <p style={{ fontWeight: 600, fontSize: 15 }}>{title}</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</p>
    </div>
  );
}
