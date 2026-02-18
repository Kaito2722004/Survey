import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { notificationsService } from "@/services/notifications";
import type { NotificationRow } from "@/services/notifications";

type NotificationsContextType = {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const list = await notificationsService.getUnread(user.id);
      setNotifications(list);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        await notificationsService.markAsRead(id, user.id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } catch (e) {
        console.error("Failed to mark notification as read:", e);
      }
    },
    [user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await notificationsService.markAllAsRead(user.id);
      setNotifications([]);
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  }, [user?.id]);

  const value: NotificationsContextType = {
    notifications,
    unreadCount: notifications.length,
    loading,
    refetch,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return ctx;
}
