import { Avatar, AvatarFallback, AvatarImage, type AvatarSize } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types";

interface UserAvatarProps {
  readonly user: UserSummary;
  /**
   * Forwarded to `Avatar`. Prefer this over `className="size-5"`: the named
   * step also scales the initials in the fallback, which a width class on its
   * own cannot do. `className` still wins on the circle for anything the
   * ladder does not cover.
   */
  readonly size?: AvatarSize;
  readonly className?: string;
}

export function UserAvatar({ user, size, className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={cn("ring-1 ring-border", className)}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
      <AvatarFallback style={user.accentColor ? { color: user.accentColor } : undefined}>
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );
}
