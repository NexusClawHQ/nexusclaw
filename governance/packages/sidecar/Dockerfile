# Single-container zero-config sidecar (spec mcp-governance-gateway Phase F).
# Build from the governance/ workspace root:
#   docker build -f packages/sidecar/Dockerfile -t agent-governance-sidecar .
# Run (embedded Postgres, demo scenario, MCP gateway — no external deps):
#   docker run -p 7899:7899 agent-governance-sidecar
# Persist audit data:
#   docker run -p 7899:7899 -v ag-sidecar-data:/app/data agent-governance-sidecar
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/sidecar packages/sidecar
COPY packages/contracts packages/contracts
COPY packages/permission packages/permission
COPY packages/guardrail packages/guardrail
COPY packages/approval packages/approval
COPY packages/audit-chain packages/audit-chain
COPY packages/outbox packages/outbox
COPY packages/governor packages/governor
COPY packages/executor packages/executor
RUN pnpm install --frozen-lockfile --filter @agent-governance/sidecar... && \
    pnpm -r --filter @agent-governance/sidecar... run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production SIDECAR_PORT=7899 SIDECAR_LISTEN_HOST=0.0.0.0 SIDECAR_STORAGE=local SIDECAR_STORAGE_LOCAL_DIR=/app/data
RUN corepack enable
COPY --from=build /app /app
EXPOSE 7899
VOLUME /app/data
CMD ["node", "packages/sidecar/dist/bin/sidecar.js"]
