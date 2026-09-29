# PackRat provenance canaries / watermark model

## What this is for

PackRat should be able to recognize output produced by the PackRat factory and later corroborate where that output came from.

This is **not** DRM and it is not contractor monitoring.

A builder who possesses source can remove a marker. A builder who writes a product independently may never contain a PackRat marker. The value is that normal use of the PackRat factory automatically leaves several consistent pieces of provenance evidence.

## Recommended layers

### 1. Machine-readable package marker — strongest searchable watermark

Every official PackRat build receives a generated `PACKRAT-PROVENANCE.json`.

Example field:

```json
{
  "packrat_build_marker": "PKR1-0123456789ABCDEF0123",
  "provenance_id": "PRV1-..."
}
```

For Stream Deck, the official CLI packages all ordinary files beneath the plugin directory except its documented exclusions, so the marker can travel inside the final `.streamDeckPlugin` without changing runtime behavior. Every candidate must still pass the official validator/package command.

For XENEON/iCUE, the same approach must remain behind official validation/package compatibility. The PoC workflow tests an extra provenance file against the current official CLI before treating this as supported.

This marker is easy to find after extracting a package and easy to remove if someone deliberately knows to remove it.

### 2. Factory structural canary

Private factory templates should also emit a harmless structural signature that is not one single magic string—for example stable generated key ordering, deterministic metadata ordering, or a nonfunctional generated constant used by the PackRat build-report path.

Do not intentionally degrade the product or make behavior depend on this canary.

This survives an accidental copy of the generator better than one visible metadata file, but deliberate refactoring can remove it.

### 3. Marketplace description sentence

The factory deterministically generates one natural sentence from the build provenance.

Example:

```text
Built for simple setup, clear feedback, and everyday control with predictable behavior.
```

Rat Ship should insert that exact sentence once into the long Marketplace description, ideally near the low-priority/support portion of the description rather than the title or hero copy.

Why:
- it is searchable on the open web / Marketplace;
- it gives PackRat a second independent place to compare;
- ordinary copy/paste reuse carries it forward.

Do not use zero-width Unicode, fake spelling mistakes, invisible HTML, or deceptive text. Those are brittle, may be normalized by Marketplace, and are harder to explain as legitimate provenance evidence.

The sentence is corroborating evidence only. A seller can edit it.

### 4. Marketing-art canary — optional later private layer

Rat Art may eventually encode the provenance ID into an innocuous, documented PackRat footer micro-pattern in the rendered pixels.

Do not rely on PNG metadata: image services may strip metadata.

A pixel canary should be:
- visually harmless;
- outside important product imagery;
- robust enough to survive ordinary Marketplace scaling;
- documented in PackRat's private provenance ledger;
- never used to collect user data.

This should be tested for resize/recompression survivability before production use.

## Public mode vs private mode

### Public PoC mode

The canary is derived deterministically from public provenance inputs.

This proves the automation and lets PackRat test scanning/search behavior.

It is **not secret**. Anyone reading this repository can reproduce or remove it.

### Private production mode

Keep the same output contract, but derive the provenance ID from a PackRat-only HMAC/KMS key and sign the provenance manifest.

The builder never receives:
- the provenance key;
- private canary derivation state;
- the private ledger;
- PackRat signing authority.

## What a later investigation can say

Strong:
- "This exact package contains PackRat marker X."
- "PackRat's ledger says marker X corresponds to source commit Y, PR Z and package SHA-256 H."
- "This Marketplace description also contains the exact canary sentence generated for that build."
- "The package bytes exactly match / or share documented PackRat structural signatures."

Not proven by the marker alone:
- who copied it;
- whether similar code was independently written;
- whether a contractor deleted every copy;
- ownership of third-party/open-source code;
- use of PackRat if the copier intentionally removed every marker.

The primary protection remains access control + contract/IP rights + PackRat's private build/ledger history.
