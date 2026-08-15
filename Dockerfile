FROM node:22.18.0-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/backend/package.json ./packages/backend/package.json
RUN npm ci --ignore-scripts

COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.build.json ./packages/shared/tsconfig.build.json
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/tsconfig.json ./packages/backend/tsconfig.json
RUN npm run build

FROM node:22.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
