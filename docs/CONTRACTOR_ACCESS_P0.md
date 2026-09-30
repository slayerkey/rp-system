# Contractor access P0

No contractor should receive PackRat repository access until every **BLOCKING** item below is complete.

## Completed in repository code

- [x] Marketplace intelligence no longer needs a direct push to `main`; it proposes an automation-branch PR.
- [x] CODEOWNERS policy is defined for the public control plane.
- [x] New unreleased `status: idea` / `type: idea` records are prohibited from public `products/index.json`.
- [x] Existing public idea records were removed from the current index. Git history remains public.
- [x] Window Manager Pro private QA no longer publishes the paid package from public Actions.
- [x] Audio Manager Pro, Internet Health Pro, Monitor Manager Pro, and Voice Deck public workflows publish hashes/evidence instead of paid package binaries.
- [x] Contractor product repository template exists.
- [x] Manual private-factory intake workflow template exists.
- [x] Provenance ledger schema guidance exists.
- [x] Public-mode provenance/watermark tooling exists and has passed Stream Deck and XENEON packaging tests.

## BLOCKING GitHub administration

These require GitHub account/organization administration and are not available through the current ChatGPT GitHub connector:

- [ ] Create PackRat GitHub organization.
- [ ] Put organization on the desired Team plan.
- [ ] Create first private `packrat-product-<sku>` repository.
- [ ] Add the builder with **Write** permission only.
- [ ] Protect product `main`: PR required, one owner approval, CODEOWNERS, stale approval dismissal, approval after latest push, conversations resolved, force pushes/deletion blocked.
- [ ] Protect `rp-system/main` after the Marketplace bot PR change is merged.
- [ ] Create private `packrat-factory`.
- [ ] Create private `packrat-provenance-ledger`.
- [ ] Create private `packrat-commercial`.
- [ ] Add private factory production secret/KMS material. Never add the production provenance key to public `rp-system`.

## BLOCKING legacy artifact migration

Several older XENEON/public release workflows still pass paid packages between GitHub Actions jobs using public Actions artifacts. They must be moved to `packrat-factory` or refactored to rebuild inside a private job before contractor access is granted.

Known migration families include:

- Discord Voice Panel
- HWiNFO Sensor Dashboard
- Retro Terminal Pro
- Smart Lighting Control
- Window Manager for XENEON
- Windows Settings Manager Lite/Pro combined pipelines
- Home Assistant diagnostic/release paths
- generic XENEON widget / Rat Ship / recovery pipelines that can process paid SKUs

Treat this section as **not complete** until the private factory exists and the public workflows contain only sanitized evidence for paid SKUs.

## BLOCKING legal execution

- [ ] Final contractor identity/legal name and signature details.
- [ ] Contractor agreement completed with the PackRat technical-access exhibit attached.
- [ ] Both parties sign the final agreement.
- [ ] Attorney review if PackRat wants jurisdiction-specific enforceability advice.

Technical controls and provenance records support evidence; they do not by themselves create or guarantee legal enforceability.

## Inputs needed at onboarding

After the GitHub organization/private repositories exist, PackRat only needs:

1. contractor GitHub username;
2. first assigned product/SKU.

PackRat can generate the internal builder ID and assignment ID.
