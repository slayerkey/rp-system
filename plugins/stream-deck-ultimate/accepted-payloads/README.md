# Accepted Stream Deck Ultimate v1.0 hardware payloads

These `.zlib` files are byte-exact compressed copies of the seven runtime files that changed during physical Stream Deck acceptance. `SHA256.json` records the required uncompressed digest for each destination path.

They exist so a clean build from the recovered upstream authoring source can deterministically restore the exact accepted v1.0 behavior before applying Marketplace-only icon corrections.

Do not edit the payloads manually. Update them only from a newly hardware-accepted runtime and update the SHA-256 manifest at the same time.
