# Public-first operating mode

PackRat can validate the contractor architecture now while `slayerkey/rp-system` remains public.

## What public mode automates

On every relevant PR:

1. validate the immutable contractor intake descriptor;
2. generate a deterministic provenance manifest;
3. generate a machine-readable package canary;
4. generate an exact searchable Marketplace-description canary sentence;
5. scan generated evidence for the expected canary;
6. test Stream Deck package compatibility for the extra provenance file;
7. test XENEON/iCUE package compatibility for the extra provenance file;
8. upload non-secret PoC evidence.

## What public mode intentionally does NOT do

- no production provenance secret;
- no hidden secret algorithm;
- no Marketplace credential;
- no private PackRat source;
- no owner commercial data;
- no contractor monitoring.

The public mode is useful for proving the mechanics and product compatibility.

## Private cutover later

The workflow contract does not change.

Replace:

```text
public deterministic provenance derivation
```

with:

```text
PackRat-only HMAC/KMS provenance generation
+ signed provenance manifest
+ private append-only ledger
```

Then move the factory/provenance workflows to private PackRat infrastructure.

Contractor-facing product CI can remain almost identical.

## Human inputs still needed before a real contractor is onboarded

Only operational identity/access information:

- contractor GitHub username;
- an internal builder ID (PackRat can generate one if no preference);
- the first assigned product/SKU.

Everything else can use the default architecture documented here.
