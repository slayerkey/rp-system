# Contractor boundary threat-model acceptance criteria

This PoC is accepted only if the production architecture preserves these properties:

| Risk | Required technical property | Residual limitation |
| --- | --- | --- |
| Clone full PackRat factory | Builder account has no read permission to private factory, ledger, commercial data, or sibling product repos. | Anything already public in rp-system cannot be made secret retroactively. |
| Publish assigned product under another account | Marketplace credentials and final release authority remain PackRat-only; release evidence is retained. | A builder who can read product source can copy it; this is also a contract/IP problem. |
| Reuse private generators | Generators execute only in PackRat-owned infrastructure and return sanitized outputs/errors. | Public generators already disclosed remain public knowledge. |
| Copy unreleased ideas | Assignment contains only the product-specific spec needed to build the SKU. | The assigned idea itself is necessarily disclosed. |
| Retain source after termination | Access revokes centrally and source of truth remains PackRat-owned. | Revocation cannot erase clones already made. |
| Obtain credentials | Contractor repo has no production secrets; no production secret is passed to contractor-controlled workflows. | Test credentials must also be scoped and revocable. |
| Become sole maintainer | Acceptance requires source, tests and developer notes committed remotely. | Some tacit knowledge can still exist; owner review reduces concentration. |
| Keep critical source only locally | Private QA accepts only GitHub commit SHAs from the assigned repo. | Unpushed experiments are not PackRat release evidence. |
| Copy API keys | Secret-like intake fields fail; production keys stay private; scanning is an additional gate. | A malicious actor can copy any credential they are legitimately shown. |
| Strip origin evidence | Owner ledger records source SHA, PR, run, artifact hash and provenance before release. | Embedded identifiers can be removed; ledger evidence is corroborative. |
| Mislabel public data as trade secret | Public/current rp-system material is classified as public/background material. | Legal classification still requires counsel and facts. |
| Make work too slow | Builder keeps local/public lint, unit tests and vendor validation; private gate returns sanitized actionable failures. | Private QA adds a CI round trip by design. |
