let accessToken: string | null = null;

type TokenListener = (token: string | null) => void;

let listeners: readonly TokenListener[] = [];

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  if (accessToken === token) return;

  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export function onAccessTokenChange(listener: TokenListener): () => void {
  listeners = [...listeners, listener];

  return () => {
    listeners = listeners.filter((registered) => registered !== listener);
  };
}
