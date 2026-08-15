# Community Architecture and Boundary

## Runtime path

The Community snapshot preserves one auditable vertical slice:

```text
authenticated caller
  → Community intent routing
  → Executor Engine
  → permission and RAG authorization ports
  → controlled CRM/runtime tools
  → execution, audit and attribution records
```

The PostgreSQL baseline owns the Community entities and constraints required by
this path. Redis is available for runtime coordination. A deterministic local
provider supports repeatable smoke validation without an external model key.

## Fail-closed boundaries

Security behavior stays on the public execution path. Missing commercial or
enterprise capabilities must not silently authorize an operation, fabricate a
successful response or suppress audit records. Community adapters implement a
conservative policy or report a stable unavailable-capability code.

The only public REST controller is `GET /source`. It and a header on every API
response disclose the operator-configured HTTPS location of the Corresponding
Source. Production startup fails when `COMMUNITY_SOURCE_URL` is missing,
placeholder-valued, credential-bearing or non-HTTPS.
The operational contract is documented in
[source-compliance.md](source-compliance.md).

Agent identity remains derived from the paired service-account and role
relationship. An independent employee has both; an assistant has neither and
uses the authenticated authorizing human's role. A half-bound identity is
invalid.

## Deliberately excluded capabilities

The v1 snapshot excludes proprietary behavior-learning and publication loops,
specialized model routing and ranking, commercial billing/metering and license
implementation, enterprise identity/encryption, package registry content,
demo/help/evaluation assets and starter workspace templates.

Public runtime seams use explicit contracts for these boundaries. The
Community build does not import a sibling repository, private registry or
developer-machine configuration to compensate for excluded code.

## Snapshot provenance

Community releases are generated from an explicit commit on the private
source-of-truth `main` branch through a versioned default-deny manifest. The
exporter reads Git objects rather than the working tree, normalizes text and
modes, scans the candidate, and records source, manifest, exporter and canonical
tree digests. The first public commit is a new root and contains no private Git
parent or commit metadata.

Publication consumes a sealed candidate; it does not rebuild or regenerate the
approved content. Subsequent public commits represent adjacent approved
snapshots. Public proposals are reviewed and replayed into the private source
of truth before a later snapshot exports them.

## Deployment shape

`compose.community.yml` starts PostgreSQL, Redis and the Community backend.
`Dockerfile.community` uses the public lockfile and only the exported build
context. Deployment-specific secrets come from the operator environment and
must never be committed. See the root README for the supported commands.
