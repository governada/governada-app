FROM node:20.18-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies ──
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Upgrade bundled npm (10.x) to 11.x so `npm ci` accepts lockfiles
# produced by dependabot, which uses npm 11 and omits nested optional-peer
# entries that npm 10 rejects. Matches the bump already applied in
# .github/workflows/ci.yml's install job (#896).
RUN npm install -g npm@11 && npm ci

# ── Build ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Runtime ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# Cap heap to 512 MB — prevents silent OOM on Railway (1 GB plan)
ENV NODE_OPTIONS="--max-old-space-size=512"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE ${PORT:-3000}
# Ensure Railway sends SIGTERM (not SIGKILL) for graceful shutdown
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
