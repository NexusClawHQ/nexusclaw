# Contributing

Thank you for helping improve agent-governance. Issues, security reports,
design feedback and reproducible bug reports are welcome.

## Docs & examples contributions are open

<!-- nexusclaw-contribution-mode: docs-examples-open-code-closed -->

Pull requests that touch **only** `examples/`, recipe/guide content in
`docs/`, or example sections inside `governance/adapters/*/README.md` are
accepted directly. By opening such a pull request you license your
contribution under the repository's Apache-2.0 license (inbound = outbound)
and add the DCO sign-off line (`Signed-off-by: Name <email>`, `git commit -s`)
to every commit. Look for issues labeled
[`good first issue`](https://github.com/NexusClawHQ/nexusclaw-agent-governance/labels)
for suitable starting points.

## Snapshot contribution model (kernel code)

The public repository is a reviewed release snapshot, not the implementation
source of truth. Maintainers evaluate a public proposal, perform provenance and
security review, and reproduce an accepted change in the private source-of-truth
repository. A later sealed snapshot carries the result back to the public
repository with attribution.

Do not base work on unpublished behavior or request access to private source,
customer data, credentials, internal tickets or proprietary test assets.

## Kernel code contributions are gated

The project intends to preserve a commercial dual-licensing option. Until a
Contributor License Agreement (CLA) is approved by legal counsel and published,
maintainers cannot merge external **kernel code** contributions (the
`governance/packages/*` sources and the reference slice). The docs/examples
channel above is the currently open intake; CLA publication is the stated
condition for opening the kernel channel.

Until the CLA is available, please use issues for kernel-code proposals and
follow [SECURITY.md](SECURITY.md) for vulnerabilities. A submitted kernel pull
request will be closed without merging its commits. Maintainers must not copy,
translate, retype or clean-room-label copyrightable kernel code from an
unlicensed pull request. Facts, bug descriptions and general ideas may be
used only when the private implementation is independently authored and the
review record identifies the boundary.

## Proposal quality

Describe the problem, expected Community behavior, security and compatibility
impact, and the smallest reproducible test. Remove secrets, personal data,
customer identifiers, internal URLs and proprietary material. Generated or
third-party content must identify its source and license.

When code contribution intake opens, the published CLA and contribution guide
will define authorship, attribution, testing and review requirements. No
unpublished agreement is incorporated by reference here.
