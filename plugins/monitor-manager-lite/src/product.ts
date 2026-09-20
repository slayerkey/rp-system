export const PRO_MARKETPLACE_URL: string | null = "https://marketplace.elgato.com/product/monitor-manager-pro-d1f16ff0-2433-4b67-991d-8dd9fcddd425";

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
