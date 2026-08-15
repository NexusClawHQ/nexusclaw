# Licensing FAQ

> This FAQ is general information, not legal advice. License obligations depend
> on the facts, the software involved and applicable law. Consult qualified
> counsel for your situation. If this FAQ conflicts with the license, the
> license controls.

## What license applies to NexusClaw Community?

The Community snapshot is offered under the GNU Affero General Public License,
version 3 only, identified by SPDX as `AGPL-3.0-only`. Read the complete
[GNU AGPL v3 text](https://www.gnu.org/licenses/agpl-3.0.html). The Open Source
Initiative lists GNU AGPL version 3 among its
[approved licenses](https://opensource.org/licenses).

Third-party dependencies and separately identified material remain under their
own licenses. The release SBOM, dependency license report and provenance record
identify those components; the root license does not relicense them.

## What does network use mean under the AGPL?

Section 13 of the AGPL contains an additional source-offer condition for a
modified Program when users interact with it remotely through a computer
network. The exact scope and the meaning of Corresponding Source must be read
in the complete license. This FAQ does not determine whether a particular
deployment, modification or combination triggers an obligation.

NexusClaw Community requires `COMMUNITY_SOURCE_URL`, advertises it on every API
response and exposes it through `GET /source`. If you deploy a modified version,
that URL must provide the complete Corresponding Source for the version users
are actually interacting with; pointing it at an unmodified upstream snapshot
is not sufficient.

## Is internal organizational use always exempt?

Do not rely on a blanket statement. The GNU
[GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html) discusses internal copying,
distribution within organizations, contractors and network interaction as
fact-dependent topics. Organizational structure, transfers, modifications and
who can interact with a service may matter. Obtain legal advice for the actual
deployment.

## Can I combine Community code with other software?

Compatibility and resulting obligations depend on how the works are combined,
linked, modified and conveyed. Review the full license and every component's
license. Neither a process boundary nor a package name alone determines the
legal result.

## Is a commercial license available?

The project intends to offer commercial licensing for organizations that need
different terms. Use the official commercial-licensing contact published by the
NexusClaw organization. A commercial license is effective only through an
executed agreement with the authorized rights holder; this FAQ grants no
commercial rights.

## Can I contribute under a DCO sign-off?

Not currently. The project plans to use a legal-approved CLA to preserve
dual-licensing rights. A DCO sign-off is a provenance statement and is not
treated here as a substitute for the required relicensing grant. Until the CLA
is published, external code contributions cannot be merged; see
[CONTRIBUTING.md](../CONTRIBUTING.md).

## Where are the authoritative references?

- [GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html)
- [GNU licenses FAQ](https://www.gnu.org/licenses/gpl-faq.html)
- [OSI approved licenses](https://opensource.org/licenses)
- the `LICENSE`, `NOTICE`, SBOM, dependency license report and provenance files
  shipped in the same NexusClaw Community release
