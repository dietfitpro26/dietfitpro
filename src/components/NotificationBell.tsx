import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface Props {
  to: "/pro/notifications" | "/patient/notifications";
  className?: string;
  iconClassName?: string;
}

export function NotificationBell({ to, className, iconClassName }: Props) {
  const { unreadCount } = useNotifications();
  return (
    <Link
      to={to}
      className={cn("relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted", className)}
      aria-label="Notifications"
    >
      <Bell className={cn("h-5 w-5", iconClassName)} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
