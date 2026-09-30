# PackRat GitHub admin P0 runbook

Use this only after PR #207 is merged.

## 1. Create the organization

Create a GitHub organization for PackRat and place it on the GitHub Team plan.

Recommended organization settings:
- base repository permission: None
- repository creation: owner/admin controlled
- outside collaborators allowed only when intentionally assigned
- do not grant the contractor organization-owner, billing, security-manager, or broad team access

## 2. Protect slayerkey/rp-system main

Create an active branch ruleset targeting the default branch/main.

Required:
- require a pull request before merging
- at least 1 approval
- require review from Code Owners
- dismiss stale approvals when new commits are pushed
- require approval of the most recent reviewable push
- require all conversations resolved
- block force pushes
- restrict/deactivate branch deletion
- require status checks:
  - RatPack Lightweight CI / context
  - PackRat Public Boundary Policy / public-index-policy
  - PackRat Public Boundary Policy / workflow-artifact-policy
  - PackRat Public Boundary Policy / marketplace-bot-policy

Do not give the Marketplace intelligence automation a direct-main bypass. It now updates an automation branch and opens/refreshes a PR.

## 3. Create private repositories

Create these private repositories under the PackRat organization:

- packrat-factory
- packrat-provenance-ledger
- packrat-commercial
- packrat-product-<first-sku>

Set default branch to main.

Do not initialize the contractor product repo with access to any sibling repository.

## 4. First contractor product repository access

Add the contractor only to packrat-product-<first-sku> with the Write role.

Do not give:
- Maintain
- Admin
- organization-owner
- access to packrat-factory
- access to packrat-provenance-ledger
- access to packrat-commercial
- access to unrelated product repositories
- access to slayerkey/vcs

Copy the contents of:
prototype/contractor-access/templates/product-repo/

into the root of the private product repository.

## 5. Product repository main ruleset

Create an active ruleset targeting main:

- require pull request
- 1 approval
- require Code Owner review
- dismiss stale approvals
- require approval after latest push
- resolve conversations
- block force pushes
- block deletion
- required check: Contractor CI / contractor-ci

The contractor may push feature branches but must not directly update main.

## 6. Private factory

Copy:
prototype/contractor-access/templates/private-factory/

into packrat-factory.

The first supported trigger is manual workflow_dispatch. The later GitHub App broker can call the same intake contract.

Only PackRat owners/admin automation should have access.

## 7. Provenance ledger

Initialize packrat-provenance-ledger from:
prototype/contractor-access/templates/provenance-ledger/

Keep it private. Do not put signing keys in this repository.

## 8. Production provenance secret

In packrat-factory, create a production secret named:

PACKRAT_PROVENANCE_KEY

Use a cryptographically random value of at least 32 bytes.

Also create:

PACKRAT_PROVENANCE_KEY_ID

Use a non-secret version identifier such as packrat-prod-v1.

Do not copy either secret into the contractor product repository or public rp-system.

For the stronger final design, replace raw repository-secret signing with a KMS/asymmetric signing key while preserving the same provenance descriptor.

## 9. Commercial repository

Move future owner-only material into packrat-commercial:
- unreleased ideas
- product rankings
- private Marketplace opportunity analysis
- sales/revenue exports and synthesis
- contractor economics
- roadmap/prioritization

Historical data already committed to public rp-system remains public through Git history. Do not treat it as a trade secret merely because it is later deleted.

## 10. Contractor agreement gate

Before access:
- final legal names/contact details
- final compensation terms
- IP/confidentiality agreement
- PackRat technical-access exhibit attached
- signatures from both parties

No repository invitation should be sent before the agreement is executed.
