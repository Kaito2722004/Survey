import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { NotificationRow } from "@/services/notifications";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

function getNotificationLink(
  n: NotificationRow,
  isAdmin: boolean
): string | null {
  if (!n.survey_id) return null;
  if (isAdmin) {
    return `/admin/surveys/${n.survey_id}/analytics`;
  }
  if (
    n.type === "new_survey" ||
    n.type === "survey_deadline_1h" ||
    n.type === "survey_expired"
  ) {
    return `/student/survey/${n.survey_id}`;
  }
  return null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const handleNotificationClick = async (n: NotificationRow) => {
    const isAdmin = !!user?.isAdmin;
    const link = getNotificationLink(n, isAdmin);
    await markAsRead(n.id);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground",
                unreadCount > 99 && "px-1.5"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={markAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const isAdmin = !!user?.isAdmin;
                const link = getNotificationLink(n, isAdmin);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {n.title ?? "Notification"}
                        </span>
                        {link && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {isAdmin
                              ? "View analytics"
                              : n.type === "survey_expired"
                                ? "View survey"
                                : "Take survey"}
                            <ExternalLink className="ml-1 inline h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {n.message && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.message}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
