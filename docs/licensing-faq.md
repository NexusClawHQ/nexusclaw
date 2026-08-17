# Licensing FAQ

> This FAQ is general information, not legal advice. License obligations depend
> on the facts, the software involved and applicable law. Consult qualified
> counsel for your situation. If this FAQ conflicts with the license, the
> license controls.

## What license applies to NexusClaw Community?

The Community snapshot is offered under the Apache License, Version 2.0,
identified by SPDX as `Apache-2.0`. Read the complete
[Apache-2.0 text](https://www.apache.org/licenses/LICENSE-2.0). The Open Source
Initiative lists Apache-2.0 among its
[approved licenses](https://opensource.org/licenses).

Third-party dependencies and separately identified material remain under their
own licenses. The release SBOM, dependency license report and provenance record
identify those components; the root license does not relicense them.

## What can I do with the code under Apache-2.0?

Apache-2.0 is a permissive license: you may use, copy, modify, distribute,
sublicense and build commercial products on this code, including in closed-source
deployments and hosted services, subject to the license conditions — notably
retaining license and notice text, stating significant changes you made, and
the patent grant/termination terms. Read the complete license for the exact
conditions; this FAQ does not summarize them exhaustively.

## Is the source-disclosure machinery still required?

No — and that is deliberate. The `GET /source` endpoint, the
`COMMUNITY_SOURCE_URL` advertisement and the deterministic provenance record
began life as AGPL §13 compliance machinery. Under Apache-2.0 they are no
longer legal obligations; we keep them as a voluntary transparency commitment,
because verifiable provenance is part of what makes a governed agent runtime
trustworthy. You are free to disable them in your own deployments.

## Can I combine Community code with other software?

Generally yes, including with GPL-family code in most cases (Apache-2.0 is
one-way compatible with GPLv3). Compatibility and resulting obligations depend
on how the works are combined, linked, modified and conveyed. Review the full
license and every component's license before distributing combinations.

## Is a commercial license available?

The commercial offering is not a license exception — Apache-2.0 already permits
commercial use. The commercial edition sells what the community edition does
not contain: the AI learning layer, model routing and ranking, enterprise
identity/SSO, multi-workspace management, audit reporting, SLA and support.
Use the official commercial contact published by the NexusClaw organization.

## Can I contribute under a DCO sign-off?

Not currently. External code contributions are closed at this stage; see
[CONTRIBUTING.md](../CONTRIBUTING.md). When contributions open, the project
intends to accept them under a Developer Certificate of Origin sign-off, which
pairs naturally with Apache-2.0.

## Where are the authoritative references?

- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [OSI approved licenses](https://opensource.org/licenses)
- the `LICENSE`, `NOTICE`, SBOM, dependency license report and provenance files
  shipped in the same NexusClaw Community release
