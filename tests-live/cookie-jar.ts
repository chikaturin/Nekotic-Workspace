/**
 * Hũ cookie cho Node.
 *
 * Trình duyệt tự giữ cookie; `fetch` của Node thì không. Mà refresh token của
 * backend này là một HttpOnly cookie — nghĩa là nếu không có hũ cookie thì
 * đường `restore()` (F5 rồi vẫn còn đăng nhập) KHÔNG thể test được ở đây, và đó
 * lại đúng là đường dễ hỏng nhất khi nối FE với BE.
 *
 * Bọc `globalThis.fetch` thay vì sửa client: client phải chạy y hệt như trên
 * trình duyệt, không được biết là mình đang bị test.
 */
const jar = new Map<string, string>();

type FetchArgs = Parameters<typeof fetch>;

const nativeFetch = globalThis.fetch;

/** Đọc `Set-Cookie` (có thể nhiều dòng) và cất từng cặp name=value. */
function absorb(response: Response): void {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const index = pair?.indexOf("=") ?? -1;
    if (!pair || index <= 0) continue;

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    // Cookie rỗng là lệnh XOÁ (server logout dựng Max-Age=0), không phải giá trị.
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

const cookieHeader = (): string =>
  [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

export function installCookieJar(): void {
  globalThis.fetch = async (...args: FetchArgs): Promise<Response> => {
    const [input, init] = args;
    const headers = new Headers(init?.headers);

    const cookie = cookieHeader();
    if (cookie) headers.set("cookie", cookie);

    const response = await nativeFetch(input, { ...init, headers });
    absorb(response);
    return response;
  };
}

export const cookieJar = {
  names: (): readonly string[] => [...jar.keys()],
  has: (name: string): boolean => jar.has(name),
  get: (name: string): string | undefined => jar.get(name),
  clear: (): void => jar.clear(),
};
