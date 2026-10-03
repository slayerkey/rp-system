// Global PackRat release rule: creator branding belongs in Author, assets and
// descriptive copy, never in the customer-visible Marketplace product title.
// Existing published SKUs are not renamed by this validator until deliberately resubmitted.
export const PACKRAT_TITLE_RE = /\bpack[\s-]*rat\b/i;

export function assertMarketplaceTitle(title, source = 'Marketplace title') {
  const name = String(title ?? '').trim();
  if (!name) throw new Error(`${source} is empty`);
  if (PACKRAT_TITLE_RE.test(name)) {
    throw new Error(`${source} cannot contain PackRat. Use a product-first name without creator branding; retain PackRat in the creator/Author field instead. Received: "${name}"`);
  }
  return name;
}
