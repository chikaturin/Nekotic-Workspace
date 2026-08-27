"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import type { DriveNode } from "@/types";

/**
 * Starred, or not.
 *
 * One shape, two fills. A star is *the* universal control whose two states are
 * hollow and solid, and the app had been spelling "starred" three different
 * ways: a filled star in the file table, a slashed `StarOff` in the viewer, and
 * another slashed one on the Favorites page.
 *
 * The slash is the one to lose. `StarOff` is a star with a line through it,
 * which reads as *forbidden* rather than *off* — and on the Favorites page,
 * where every row is starred by definition, showing a crossed-out star next to
 * a favourite is the exact opposite of the state it is describing. Whether it
 * meant "this is not a favourite" or "click to stop it being one" was a coin
 * toss, and the reader had to make it on every row.
 *
 * Hollow means no, solid means yes, and nothing means "no" twice.
 */
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

/**
 * The star as a control.
 *
 * Hovering it empties a full star and fills an empty one, so the button shows
 * what the click will do before the click — which is the whole reason a toggle
 * gets to be one icon rather than two.
 */
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
