# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Install dependencies
RUN npm install --workspaces --include-workspace-root

# Generate Prisma client
RUN npm run prisma:generate --workspace packages/db

# Build packages
RUN npm run build --workspace packages/db
RUN npm run build --workspace apps/worker

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
