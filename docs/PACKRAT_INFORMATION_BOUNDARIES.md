# PackRat information boundaries

This public repository is a public control plane and public-source workspace. It is not the system of record for PackRat-private commercial strategy or release artifacts.

## Public-safe

- published/open product metadata
- public SDK/build documentation
- public-source implementation
- public validators and non-secret QA logic
- sanitized hashes and provenance references
- contractor-boundary interface documentation

## Do not add to this public repository

- unreleased product ideas or private roadmap entries
- owner-only sales rankings, revenue analysis, or private commercial synthesis
- Marketplace credentials or authenticated browser state
- production provenance/HMAC/signing keys
- private contractor source that is intentionally segregated
- paid/private packaged release binaries in public GitHub Actions artifacts
- final private SHIP_KIT release bundles

`products/index.json` must only contain non-idea product records. New idea/roadmap records belong in the future private PackRat commercial repository.

Public CI may build paid products for validation, but it must publish only sanitized evidence such as hashes, reports, screenshots, and QA summaries—not the paid/private package itself.

The Marketplace intelligence workflow must propose data refreshes by pull request rather than pushing directly to `main`. This is required so `main` can be protected without granting a bot a direct-write exception.

## Private cutover targets

- `packrat-factory` — private build/release authority
- `packrat-provenance-ledger` — private append-only provenance records
- `packrat-commercial` — private sales intelligence, roadmap, and commercial research
- `packrat-product-<sku>` — private contractor assignment repositories

Until those repositories exist, do not move sensitive data into a different public path as a substitute.
