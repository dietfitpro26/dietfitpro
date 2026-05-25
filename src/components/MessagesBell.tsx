import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useConversations } from "@/hooks/useMessages";
import { cn } from "@/lib/utils";

interface Props {
  to: "/pro/messages" | "/patient/messages";
  className?: string;
  iconClassName?: string;
}

export function MessagesBell({ to, className, iconClassName }: Props) {
  const { totalUnread } = useConversations();
  return (
    <Link
      to={to}
      className={cn(
        "relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted",
        className,
      )}
      aria-label="Messagerie"
    >
      <MessageSquare className={cn("h-5 w-5", iconClassName)} />
      {totalUnread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#6DB33F] text-white text-[10px] font-semibold flex items-center justify-center">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </Link>
  );
}
