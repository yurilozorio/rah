# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for build
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev

# Copy package files
COPY apps/cms/package*.json ./

# Install dependencies including optional ones
RUN npm install --include=optional

# Copy source code
COPY apps/cms ./

ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for sharp/vips
RUN apk add --no-cache vips-dev

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app ./

EXPOSE 1337

CMD ["npm", "run", "start"]
