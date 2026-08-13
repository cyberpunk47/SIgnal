"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store";
import { conversationsApi, contactsApi, authApi, usersApi } from "@/lib/api";
import Sidebar from "@/components/sidebar/Sidebar";
import ToastContainer from "@/components/ui/Toast";
import { useWebSocketConnection } from "@/hooks/useWebSocketConnection";
import { useWebSocketEvents } from "@/hooks/useWebSocketEvents";
import type { Contact, Conversation, User } from "@/types";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useStore((s) => s.token);
  const currentUser = useStore((s) => s.currentUser);
  const isAuthExpired = useStore((s) => s.isAuthExpired);
  const logout = useStore((s) => s.logout);
  const setConversations = useStore((s) => s.setConversations);
  const setContacts = useStore((s) => s.setContacts);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const cacheUsers = useStore((s) => s.cacheUsers);

  useWebSocketConnection();
  useWebSocketEvents();

  // Auth guard
  useEffect(() => {
    if (token && isAuthExpired()) {
      logout();
      router.replace("/auth");
    } else if (!token) {
      router.replace("/auth");
    }
  }, [token, isAuthExpired, logout, router]);

  // Bootstrap: load conversations + contacts + refresh /me
  useEffect(() => {
    if (!token || !currentUser) return;

    async function bootstrap() {
      try {
        const [convRes, contactsRes, meRes] = await Promise.all([
          conversationsApi.list(),
          contactsApi.list(),
          authApi.me(),
        ]);

        setConversations(convRes.data);
        setContacts(contactsRes.data);
        setCurrentUser(meRes.data);

        const conversations = convRes.data as Conversation[];
        const contacts = contactsRes.data as Contact[];
        const me = meRes.data as User;

        const existingUserIds = new Set<number>([
          me.id,
          ...Object.keys(useStore.getState().userCache).map((id) => Number(id)),
        ]);

        const lookupIds = new Set<number>();

        conversations.forEach((conversation: Conversation) => {
          conversation.members.forEach((member) => {
            if (member.user_id !== me.id && !existingUserIds.has(member.user_id)) {
              lookupIds.add(member.user_id);
            }
          });
        });

        contacts.forEach((contact: Contact) => {
          if (contact.contact_user_id !== me.id && !existingUserIds.has(contact.contact_user_id)) {
            lookupIds.add(contact.contact_user_id);
          }
        });

        const resolvedUsers: Array<User | null> = await Promise.all(
          [...lookupIds].map(async (userId) => {
            try {
              return (await usersApi.lookup(String(userId))).data;
            } catch {
              return null;
            }
          })
        );

        const validUsers = resolvedUsers.filter((user): user is User => user !== null);

        if (validUsers.length > 0) {
          cacheUsers(validUsers);
        }
      } catch {
        // silent
      }
    }

    bootstrap();
  }, [token, currentUser, cacheUsers, setConversations, setContacts, setCurrentUser]);

  if (!token || !currentUser) return null;

  return (
    <div className="signal-shell">
      <Sidebar />
      <main style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
