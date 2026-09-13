export const PRO_MARKETPLACE_URL: string | null = null;

export function verifiedProMarketplaceUrl(): string | null {
  if (!PRO_MARKETPLACE_URL) return null;
  try {
    const url = new URL(PRO_MARKETPLACE_URL);
    if (url.protocol !== "https:") return null;
    if (!/(^|\.)marketplace\.elgato\.com$/i.test(url.hostname)) return null;
    if (!/\/product\//i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
