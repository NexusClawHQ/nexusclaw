# NexusClaw Community

NexusClaw Community is the auditable, self-hosted runtime slice of NexusClaw.
This snapshot focuses on the security-critical path from authenticated intent
through the executor and controlled tools to audit and attribution records.

This repository is a release snapshot. Development happens in a private
source-of-truth repository, and approved changes are exported here as reviewed,
sealed snapshots. Public pull requests are proposals; see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Included in this snapshot

- the Community backend runtime and shared contracts;
- fail-closed permission and RAG authorization paths;
- Agent identity and attribution invariants;
- executor, audit and deterministic smoke-provider support;
- PostgreSQL baseline and Docker Compose deployment inputs.

Commercial learning, model-routing, billing/metering, enterprise identity and
encryption implementations are not part of the Community snapshot. Their
absence must not make permission or audit behavior fail open. See
[docs/architecture.md](docs/architecture.md) for the boundary.

## Requirements

- Docker with Compose v2; or
- Node.js 22.18.x, npm 11.6.x, PostgreSQL 17 and Redis 7.4 for a source build.

## Start with Docker Compose

Copy `.env.example` to `.env`, replace every `replace-with-...` value with a
new local secret or the HTTPS URL of the exact corresponding public source,
then run:

```sh
docker compose -f compose.community.yml up --build
```

The backend listens on `http://localhost:3000` by default. Override
`COMMUNITY_PORT` to select another host port. Stop the stack with:

```sh
docker compose -f compose.community.yml down
```

Add `--volumes` only when you intentionally want to delete the local database
and Redis data.

Every API response advertises `COMMUNITY_SOURCE_URL`, and `GET /source`
returns the same corresponding-source location and license. Operators who
modify the program must publish the source matching their deployed version and
update this URL; do not leave it pointing to an unmodified upstream snapshot.
See [docs/source-compliance.md](docs/source-compliance.md) for the publication
and ingress verification contract.

The project does not currently claim a fixed startup time. A measured value
will be published only after the sealed candidate is timed in the documented
clean-room environment.

## Source build

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Set the variables documented in `.env.example` before starting the backend.
No sibling repository, private registry, developer home configuration or
external LLM credential is required for the deterministic smoke path.

## License and security

The Community snapshot is licensed under `AGPL-3.0-only`; see [LICENSE](LICENSE),
[NOTICE](NOTICE), and [docs/licensing-faq.md](docs/licensing-faq.md). Dependency
licenses remain their respective owners' licenses.

Please report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md). Do not place secrets, personal data or exploit
details in a public issue.
