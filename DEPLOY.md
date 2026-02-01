# Production Deployment Guide

This guide explains how to deploy the RAH application to production using Docker Compose.

## Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- A server with at least 2GB RAM and 2 CPU cores
- Domain name with DNS configured
- SSL certificates (recommended)

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url> rah
cd rah

# Copy the environment template
cp env.production.example .env.production
```

### 2. Generate Secrets

Generate secure secrets for your environment:

```bash
# Generate random secrets
echo "CMS_APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
echo "CMS_API_TOKEN_SALT=$(openssl rand -base64 32)"
echo "CMS_ADMIN_JWT_SECRET=$(openssl rand -base64 32)"
echo "CMS_TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)"
echo "CMS_JWT_SECRET=$(openssl rand -base64 32)"
echo "API_JWT_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

Copy these values to your `.env.production` file.

### 3. Configure URLs

Edit `.env.production` and set your production URLs:

```env
NEXT_PUBLIC_STRAPI_URL=https://yourdomain.com/cms
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### 4. SSL Certificates (Recommended)

Place your SSL certificates in the `nginx/ssl` directory:

```bash
mkdir -p nginx/ssl
cp /path/to/fullchain.pem nginx/ssl/
cp /path/to/privkey.pem nginx/ssl/
```

Then uncomment the SSL configuration in `nginx/nginx.conf`.

### 5. Build and Deploy

```bash
# Build all images
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Start the services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 6. Initialize Strapi

After the first deployment:

1. Access the CMS admin at `https://yourdomain.com/admin`
2. Create an admin account
3. Create an API token for the backend:
   - Go to Settings > API Tokens
   - Create a new token with full access
   - Copy the token to `STRAPI_API_TOKEN` in `.env.production`
4. Restart the api service:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production restart api
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│                    (Reverse Proxy)                           │
│              Ports 80/443 (external)                         │
└─────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
      ┌────────┐    ┌────────┐    ┌────────┐    ┌──────────┐
      │  Web   │    │  API   │    │  CMS   │    │ Uploads  │
      │ :3000  │    │ :4000  │    │ :1337  │    │ (static) │
      └────────┘    └────────┘    └────────┘    └──────────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                   ┌────────────┐
                   │ PostgreSQL │
                   │   :5432    │
                   └────────────┘
                          ▲
                          │
                   ┌────────────┐
                   │   Worker   │
                   │ (pg-boss)  │
                   └────────────┘
```

## Commands

### View logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f web
```

### Restart services

```bash
# All services
docker compose -f docker-compose.prod.yml --env-file .env.production restart

# Specific service
docker compose -f docker-compose.prod.yml --env-file .env.production restart api
```

### Update deployment

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Database backup

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U postgres app > backup-$(date +%Y%m%d).sql

# Restore backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U postgres app < backup-20240101.sql
```

### Access database

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres app
```

## Scaling

For higher traffic, consider:

1. **Database**: Use a managed PostgreSQL service (AWS RDS, DigitalOcean, etc.)
2. **CDN**: Put a CDN in front of nginx for static assets
3. **Load Balancing**: Run multiple web/api instances behind a load balancer
4. **Monitoring**: Add Prometheus/Grafana for metrics

## Troubleshooting

### Services won't start

Check the logs:
```bash
docker compose -f docker-compose.prod.yml logs --tail=100 <service-name>
```

### Database connection issues

Ensure PostgreSQL is healthy:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready
```

### Build failures

Clear Docker cache and rebuild:
```bash
docker compose -f docker-compose.prod.yml build --no-cache
```

### Out of disk space

Clean up unused Docker resources:
```bash
docker system prune -a --volumes
```
