# PackRat contractor-access boundary PoC

This proof of concept validates a **public contractor intake contract** and a **private-factory provenance primitive** without changing PackRat production access.

It is intentionally safe to keep in the current public `rp-system` repository. It contains no PackRat signing material, Marketplace credentials, private product source, sales data, or production build authority.

## Boundary demonstrated

```text
contractor product repository
        |
        | exact repo + commit + PR + sanitized artifact hash
        v
public intake validation
        |
        | approved immutable descriptor
        v
PRIVATE PACKRAT FACTORY / SIGNER (not implemented in this public PoC)
        |
        | HMAC provenance ID + signed build manifest + QA result
        v
owner-only provenance ledger
        |
        v
owner release approval -> local authenticated Maker Console submission
```

The production design should put the factory, provenance key and ledger in PackRat-only private infrastructure. The contractor-facing repository receives only the assignment, product source/assets for that SKU, public development checks, and sanitized private-QA results.

## Files

- `assignment.example.json`: minimum product assignment the builder can receive.
- `submission.example.json`: immutable intake descriptor for one contractor revision.
- `tools/security/verify-contractor-intake.mjs`: fail-closed validation of that descriptor.
- `tools/security/packrat-provenance.mjs`: deterministic HMAC-SHA256 provenance ID generator.
- `.github/workflows/contractor-boundary-poc.yml`: read-only CI self-test with an explicitly non-secret demo key.

## Production rules this PoC is designed around

1. Never place `PACKRAT_PROVENANCE_KEY` in a contractor-accessible repository, runner, log, artifact, or source tree.
2. Private QA checks out contractor source at an exact commit; it does not run the private factory inside a contractor-controlled Actions job.
3. Build results returned to the contractor are sanitized. Private generators, private tests, commercial intelligence and owner-only release data are not uploaded.
4. The HMAC provenance ID is corroborating evidence, not a DRM mechanism. A watermark embedded in an artifact can be stripped.
5. The authoritative record is the owner-only ledger tying source commit, PR, workflow run, artifact SHA-256 and provenance ID together.
6. Marketplace authentication remains owner-local, consistent with the existing PackRat Maker Console boundary.

## Running the PoC

```bash
node tools/security/verify-contractor-intake.mjs prototype/contractor-access/submission.example.json > /tmp/intake.json

PACKRAT_PROVENANCE_KEY='POC-ONLY-THIS-IS-NOT-A-PRODUCTION-SECRET-0001' \
PACKRAT_PROVENANCE_KEY_ID='poc-v1' \
node tools/security/packrat-provenance.mjs /tmp/intake.json /tmp/provenance.json
```

The production version should additionally sign the provenance manifest with an asymmetric signing key or cloud KMS key so PackRat can prove the manifest was issued by its build service without disclosing the signing key.
