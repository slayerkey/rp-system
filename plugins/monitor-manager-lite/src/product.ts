export const PRO_MARKETPLACE_URL: string | null = null;

export function verifiedProMarketplaceUrl(): string | null {
  if (!PRO_MARKETPLACE_URL) return null;
  try {
    const url = new URL(PRO_MARKETPLACE_URL);
    if (url.protocol !== "https:") return null;
    if (url.hostname.toLowerCase() !== "marketplace.elgato.com") return null;
    if (url.search || url.hash) return null;
    if (!/^\/product\/[a-z0-9][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
