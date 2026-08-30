"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { DriveNode } from "@/types";

export function FavoriteStar({
  isFavorite,
  className,
}: {
  readonly isFavorite: boolean;
  readonly className?: string;
}) {
  return (
    <Star
      aria-hidden="true"
      className={cn(isFavorite && "fill-accent text-accent", className)}
    />
  );
}

interface FavoriteButtonProps {
  readonly node: DriveNode;
  readonly size?: "icon" | "icon-sm";
  readonly className?: string;
}

export function FavoriteButton({ node, size = "icon-sm", className }: FavoriteButtonProps) {
  const toggleFavorite = useWorkspaceStore((state) => state.toggleFavorite);

  return (
    <Button
      size={size}
      variant="ghost"
      aria-pressed={node.isFavorite}
      aria-label={
        node.isFavorite ? `Remove ${node.name} from favorites` : `Add ${node.name} to favorites`
      }
      className={cn("group/star", className)}
      onClick={() => toggleFavorite(node.id)}
    >
      <FavoriteStar
        isFavorite={node.isFavorite}
        className={
          node.isFavorite
            ? "transition-colors group-hover/star:fill-transparent group-hover/star:text-faint-foreground"
            : "transition-colors group-hover/star:fill-accent group-hover/star:text-accent"
        }
      />
    </Button>
  );
}
