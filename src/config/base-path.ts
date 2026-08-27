/**
 * Where the app is mounted on its host.
 *
 * `next.config.ts` and the client both need this: the config to prefix every
 * built URL, the client to strip it back off `window.location.pathname` before
 * matching a route. Declaring it twice is how they drift.
 */
export const BASE_PATH = "/Nekotic-Workspace";
