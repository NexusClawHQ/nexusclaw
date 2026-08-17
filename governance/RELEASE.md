# Releasing the agent-governance packages

How the two publication targets ship from this repository. Both are owner-side
actions that require registry credentials; everything else is prepared
in-repo by CI-checked configuration.

## npm — the nine `@agent-governance/*` packages

Versioning uses [changesets](https://changesets/) with a **fixed** group: all
nine packages release together at the same version, and
`publishConfig.access` is `public` in every manifest (scoped packages would
otherwise default to restricted).

Per release, from `governance/`:

```sh
corepack pnpm install
corepack pnpm changeset version        # apply pending .changeset/*.md
corepack pnpm release:publish:npmjs    # workspace build + publish, registry pinned to registry.npmjs.org
```

The `release:publish:npmjs` variant pins the registry explicitly, so
maintainers whose default npm registry is a mirror (e.g. npmmirror) still
publish to the real one. The initial 0.1.0 version bump is already applied
in this tree — once the `agent-governance` organization exists, the first
release is a single `corepack pnpm release:publish:npmjs`.

Commit the version bump (`packages/*/package.json`, `pnpm-lock.yaml`, the
consumed changeset files) and let CI go green before publishing.
`changeset publish` rewrites the `workspace:*` dependencies to the published
versions automatically.

Publishing requires an npm account with 2FA and write access to the
`@agent-governance` scope — create the organization at
<https://www.npmjs.com/org/agent-governance> before the first release.
(Verified 2026-08-17: without the organization, `changeset publish` aborts
cleanly with `E404 — Scope not found` on the first package and nothing is
published.)

## PyPI — the `agentgovernance` Python client

The distribution name is **`agentgovernance`** — the plain `agent-governance`
name is already taken on PyPI. The import name stays `agent_governance`; the
mismatch is intentional and normal for Python distributions.

```sh
cd governance/adapters/python
python -m pip install build twine
python -m build
python -m twine upload dist/*
```

## Pre-release checklist

- [ ] CI green on `main`
- [ ] `corepack pnpm verify` passes locally (build + tests + sidecar loop)
- [ ] `pnpm publish --dry-run` reviewed for at least one package (packed
      files, no secrets)
- [ ] README / ROADMAP badges updated after the first publication
