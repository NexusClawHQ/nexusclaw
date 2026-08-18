FROM node:22.23.2-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY .npmrc ./.npmrc
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/dashboard/package.json ./packages/dashboard/package.json
RUN npm ci --ignore-scripts

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.build.json ./packages/shared/tsconfig.build.json
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/tsconfig.json
COPY packages/dashboard/src ./packages/dashboard/src
COPY packages/dashboard/index.html ./packages/dashboard/index.html
COPY packages/dashboard/tsconfig.json ./packages/dashboard/tsconfig.json
COPY packages/dashboard/vite.config.ts ./packages/dashboard/vite.config.ts
# The dashboard (product-showcase surface) is built into the same image and
# served by the backend at /app; /console stays the zero-dependency demo.
RUN npm run build -w @nexusclaw/shared && npm run build -w @nexusclaw/backend && npm run build -w @nexusclaw/dashboard
# The runtime image only needs production dependencies — drop the toolchain
# (typescript, vite, vitest, react) before the runtime stage copies node_modules.
RUN npm prune --omit=dev

FROM node:22.23.2-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/dashboard/dist ./packages/dashboard/dist
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
