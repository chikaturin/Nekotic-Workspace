/**
 * Offline preview assets. Images are generated as SVG data URIs so the quick
 * preview modal works with no network and no binary fixtures in the repo.
 */

/** Cool, workspace-blue artwork so mock previews sit inside the palette. */
const PALETTES: readonly (readonly [string, string])[] = [
  ["#3b82f6", "#1e3a8a"],
  ["#0ea5e9", "#0c4a6e"],
  ["#6366f1", "#312e81"],
  ["#06b6d4", "#164e63"],
  ["#2563eb", "#172554"],
  ["#64748b", "#1e293b"],
] as const;

/** Stable hash so a given file always renders the same artwork. */
function hash(seed: string): number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return value;
}

export function svgPreview(seed: string, label: string, width = 1200, height = 800): string {
  const digest = hash(seed);
  const palette = PALETTES[digest % PALETTES.length] ?? PALETTES[0]!;
  const [from, to] = palette;
  const angle = digest % 90;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M0 0H48V48" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <rect width="${width}" height="${height}" fill="url(#p)"/>
  <circle cx="${width - 180}" cy="160" r="${90 + (digest % 60)}" fill="rgba(255,255,255,0.14)"/>
  <text x="64" y="${height - 72}" font-family="ui-monospace, monospace" font-size="42" fill="rgba(255,255,255,0.92)">${label}</text>
  <text x="64" y="${height - 28}" font-family="ui-monospace, monospace" font-size="22" fill="rgba(255,255,255,0.6)">${width} x ${height}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
