# PackRat private provenance ledger template

This repository must be private.

For each accepted build, record at minimum:

- assignment_id
- builder_id
- sku
- source_repository_id
- source_repository
- source_commit
- pull_request
- factory_commit
- factory_workflow_run
- package_sha256
- ship_kit_sha256
- provenance_id
- key_id
- signature
- accepted_at
- marketplace_product_id when known

Do not store production signing keys in the ledger repository.
