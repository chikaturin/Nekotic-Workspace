import { NotFoundFallback } from "@/components/shared/not-found-fallback";

/**
 * Exported as `404.html`, which the static host serves for every path it has
 * no file for — including workspace URLs created after the build. The fallback
 * decides which of those two this is.
 */
export default function NotFound() {
  return <NotFoundFallback />;
}
