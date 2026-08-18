# Community snapshot export policy (include-only)

This document is the fix for the root cause behind the 2026-08 boundary audit:
the private→public snapshot export was **exclusion-based** ("copy everything,
then delete a blacklist"), and the blacklist missed four classes of assets.
This policy replaces that model with an **include-only manifest** and defines
the public-repo gates that make any future drift fail CI.

## What happened (post-mortem summary)

The audit found no credentials, internal hosts, or implementation-level
algorithm leaks, but the then-current tree contradicted
[ROADMAP.md](../ROADMAP.md) *"Deliberately out of the Community edition"*:

1. **Locale trees** — `packages/shared/src/locales/{en-US,zh-CN}.ts` carried
   17,858 keys across 311 namespaces of commercial UI copy (visual builders,
   billing/license/trial, commercial learning loop, CPQ, telephony,
   platform-admin, …). The Community runtime never read them: the demo console
   page and the governance dashboard each ship their own inline key tables,
   so the true reference closure was **empty**.
2. **Platform-admin registries** — `platform-admin-route-readiness/` and
   `platform-admin-release-governance/` were structured route/promotion
   registries of the commercial platform console. Zero references.
3. **Enterprise asset contracts** — `employee-package/` (package validator,
   zero references) and the enterprise half of `agent-executable-assets/`
   (workforce bundles, release evidence/gates, Flow payload v2, CLI contract,
   AI authoring-context signing) far exceeded what the Community runtime
   imports.

## Policy

1. **The export manifest is the boundary.** The snapshot pipeline exports
   only paths explicitly listed in a reviewed manifest. Anything not listed
   is not exported — no wildcard, no "everything except …".
2. **Manifest changes require a boundary review** against the ROADMAP
   exclusion list (visual builder & marketplace, commercial learning loop /
   model routing / billing & metering, enterprise identity & modules).
3. **Contracts travel only with consumers.** A shared-package module may be
   exported only if the Community runtime (backend, dashboard, console page,
   governance adapters) imports it. Contract files that merely describe
   commercial surfaces stay private.
4. **UI copy is product IP.** Locale files in this repo must stay minimal;
   commercial UI vocabulary must never appear here in any language.

## Enforcement in this repository

Two CI gates (`ci.yml`) make regressions fail the build:

- `npm run check:i18n` — en/zh key parity **and** a hard key-count ceiling
  (`MAX_COMMUNITY_LOCALE_KEYS = 400` in `scripts/check-locale-parity.mjs`).
  The Community locale tree currently holds 2 keys.
- `npm run check:boundary` — structural gate
  (`scripts/check-community-boundary.mjs`): allowlists the top level of
  `packages/shared/src` and the files of the trimmed
  `agent-executable-assets/` module, rejects commercial-edition vocabulary in
  path names, and caps locale file size.

## Seed manifest (for the private pipeline)

The private export step should start from the tree that now exists and pass
review for every addition:

```
packages/shared/src/**            # with the per-file allowlists above
packages/backend/src/**           # community runtime + necessary entity stubs
packages/dashboard/src/**
governance/**                     # governance core + adapters (npm-published)
docs/**  examples/**  scripts/**  local-assets/**
root metadata (README, ROADMAP, CHANGELOG, LICENSE, NOTICE, compose.yml, …)
```

Diff `git ls-files` against this manifest as a release step; any file that is
tracked but unlisted fails the release until reviewed.

## Per-release checklist

1. Run both gates locally and in CI (`check:i18n`, `check:boundary`).
2. Diff the exported tree against the previous release tag — review every
   added path against the ROADMAP exclusion list.
3. Inspect published artifacts before release (`npm pack --dry-run` /
   sdist listing) — dist content mirrors src, but verify.
4. Re-read ROADMAP "Deliberately out of the Community edition" and confirm the
   repo still tells the same story the code does.

## Note on git history

Removing files does not recall history: prior commits (and any clones) still
contain the full locale trees. The recommended posture is to accept the
historical exposure, keep the trimmed tree as the canonical state, and rely on
copyright in the bilingual copy for enforcement; a history rewrite remains an
open decision for the maintainers.
