# RatPack Migration Status

Updated: 2026-08-22

## Canonical hub

`slayerkey/rp-system` is now the canonical RatPack hub.

ChatGPT should read `RATPACK.md` first, then the matching canonical skill and platform contract.

## Imported and canonical now

* RatPack entry context
* Rat router
* Rat Validate
* Rat Build
* Rat Art
* Rat QA
* Rat Ship
* Rat Update
* Rat Pulse
* Rat Gaps
* Rat Help
* iCUE / XENEON build contract
* Stream Deck platform contract
* product workflow state
* engineering and architecture standards
* art reproducibility contract
* fresh chat acceptance contract
* context and secret scanning CI gate

## Preserved but not fully absorbed yet

The original `ratpack-context-export.zip` contains the complete migration evidence and remains the source for the next absorption passes.

The following still need to move from the local factory into this repository through clean environment proofs:

1. full iCUE widget builder reference bundle
2. deterministic Stream Deck profile builder
3. shared profile assets and icon source interfaces
4. `_shared` marketing engine
5. Rat Art executable tooling
6. widget browser harness and deterministic shot tooling
7. shared QA utilities
8. opportunity and marketplace gap utilities
9. product registry and canonical product metadata
10. product source trees selected for monorepo migration
11. release and shipping tooling that does not require authenticated browser state
12. Claude adapters and legacy command evidence needed for behavior comparison

## Confirmed migration defects to fix before promotion

### Brand font resolution

Current art tooling can succeed while silently using the wrong font in a clean environment. Production marketplace art must fail when the required Packrat font cannot be resolved exactly.

### XENEON marketing capture preflight

Current XENEON marketing generation can succeed with a missing widget capture and produce a mostly blank hero. Required deterministic widget shots must be a hard preflight dependency.

### Hidden sibling dependencies

Reusable tooling must not rely on workstation sibling paths such as `_shared` or other absolute local directories. Every dependency must become versioned and explicit.

## Next technical proofs

1. prove the canonical context CI on a pull request
2. migrate the deterministic profile builder and reproduce Standard, VSD, Windows, and Mac variants in CI
3. migrate the marketing engine and make font preflight fail correctly
4. migrate widget capture tooling and make missing shots fail correctly
5. prove unattended iCUE Widget CLI validation and packaging on a clean Windows Actions runner
6. run the Riot Rank Tracker as the end to end Stream Deck acceptance product
7. run the fresh chat acceptance test with repository access and no prior RatPack conversation context

## Final local boundaries expected

* physical Stream Deck import and device behavior
* physical XENEON Edge rendering and touch behavior
* real iCUE host/provider validation
* authenticated Maker Console submission while no safe delegated submission API exists
* host application runtime checks for products that require Premiere Pro, Resolve, AutoCAD, or another desktop application

Everything else should be pushed toward ChatGPT plus GitHub plus CI by default.
