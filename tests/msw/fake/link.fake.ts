import { readDelay } from "@/services/backend";
import { ServiceError, appError } from "@/services/errors";

export interface LinkMetadata {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly siteName: string;
}

/**
 * Stand-in for a link-unfurling endpoint. Produces stable metadata from the
 * URL itself so the bookmark block has something real to render offline.
 */
async function resolve(rawUrl: string, signal?: AbortSignal): Promise<LinkMetadata> {
  const url = normalize(rawUrl);
  if (!url) {
    throw new ServiceError(
      appError("validation", "That does not look like a valid URL", {
        detail: "Include the protocol, for example https://example.com/page.",
        isRetryable: false,
      }),
    );
  }

  await readDelay(signal);

  const parsed = new URL(url);
  const slug = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname;

  return {
    url,
    title: titleize(slug),
    description: `Preview generated for ${parsed.hostname}. A real deployment would unfurl the page here.`,
    siteName: parsed.hostname.replace(/^www\./, ""),
  };
}

function normalize(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return parsed.hostname.includes(".") ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function titleize(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z]+$/i, "")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export const linkFake = { resolve };
