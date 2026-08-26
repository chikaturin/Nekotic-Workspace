import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types";

interface UserAvatarProps {
  readonly user: UserSummary;
  readonly className?: string;
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("ring-1 ring-border", className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
      <AvatarFallback
        style={user.accentColor ? { color: user.accentColor } : undefined}
        className="bg-elevated"
      >
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );
}
