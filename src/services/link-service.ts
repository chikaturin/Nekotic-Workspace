import { fileApi } from "@/services/api/file.api";

export interface LinkMetadata {
  readonly url: string;
  readonly title?: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly siteName?: string;
}

export const linkService = {
  resolve: (url: string, signal?: AbortSignal): Promise<LinkMetadata> =>
    fileApi.resolveLink(url, signal),
};
