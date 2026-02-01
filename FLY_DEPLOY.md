# Fly.io Deployment Guide

Deploy the RAH application to Fly.io on a single VPS with all services running together.

## Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account (`fly auth login`)

## Architecture

All services run on a single Fly.io machine using supervisord:

```
┌─────────────────────────────────────────────────────────────┐
│                    Fly.io Machine                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    NGINX (:8080)                     │   │
│  │              (Internal reverse proxy)                │   │
│  └──────────────────────────────────────────────────────┘   │
│           │              │              │              │    │
│           ▼              ▼              ▼              ▼    │
│      ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐  │
│      │  Web   │    │  API   │    │  CMS   │    │ Worker │  │
│      │ :3000  │    │ :4000  │    │ :1337  │    │        │  │
│      └────────┘    └────────┘    └────────┘    └────────┘  │
│                          │              │                   │
│                          └──────┬───────┘                   │
│                                 ▼                           │
│                          ┌────────────┐                     │
│                          │ PostgreSQL │                     │
│                          │   :5432    │                     │
│                          └────────────┘                     │
│                                 │                           │
│                          ┌────────────┐                     │
│                          │  /data     │  (Persistent Vol)   │
│                          │  - postgres│                     │
│                          │  - uploads │                     │
│                          └────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Create the Fly.io App

```bash
# Login to Fly.io
fly auth login

# Create the app (choose your preferred region)
fly apps create rah-app

# Create a persistent volume for data
fly volumes create rah_data --region gru --size 10
```

### 2. Configure the App Name

Edit `fly.toml` and set your app name:

```toml
app = "your-app-name"  # Change this
primary_region = "gru"  # Change to your preferred region
```

### 3. Set Secrets

Generate and set all required secrets:

```bash
# Generate secrets (run this locally to get values)
echo "CMS_APP_KEYS: $(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
echo "CMS_API_TOKEN_SALT: $(openssl rand -base64 32)"
echo "CMS_ADMIN_JWT_SECRET: $(openssl rand -base64 32)"
echo "CMS_TRANSFER_TOKEN_SALT: $(openssl rand -base64 32)"
echo "CMS_JWT_SECRET: $(openssl rand -base64 32)"
echo "API_JWT_SECRET: $(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD: $(openssl rand -base64 24)"

# Set all secrets at once
fly secrets set -a your-app-name \
  POSTGRES_PASSWORD="your-generated-password" \
  CMS_APP_KEYS="key1,key2,key3,key4" \
  CMS_API_TOKEN_SALT="your-salt" \
  CMS_ADMIN_JWT_SECRET="your-secret" \
  CMS_TRANSFER_TOKEN_SALT="your-salt" \
  CMS_JWT_SECRET="your-secret" \
  API_JWT_SECRET="your-secret" \
  STRAPI_API_TOKEN="set-after-first-deploy" \
  NEXT_PUBLIC_STRAPI_URL="https://your-app-name.fly.dev" \
  NEXT_PUBLIC_API_URL="https://your-app-name.fly.dev/api"
```

Optional WhatsApp integration secrets:

```bash
fly secrets set -a your-app-name \
  WHATSAPP_ACCESS_TOKEN="your-token" \
  WHATSAPP_PHONE_NUMBER_ID="your-id" \
  WHATSAPP_BUSINESS_ACCOUNT_ID="your-id" \
  WHATSAPP_TEMPLATE_CONFIRMATION="your-template" \
  WHATSAPP_TEMPLATE_REMINDER="your-template"
```

### 4. Deploy

```bash
# Deploy the application
fly deploy

# Check deployment status
fly status

# View logs
fly logs
```

### 5. Initialize Strapi

After first deployment:

1. Access the CMS admin at `https://your-app-name.fly.dev/admin`
2. Create an admin account
3. Create an API token:
   - Go to Settings > API Tokens
   - Create a new token with full access
   - Copy the token

4. Update the STRAPI_API_TOKEN secret:

```bash
fly secrets set -a your-app-name STRAPI_API_TOKEN="your-actual-token"
```

The app will automatically restart with the new token.

## Commands

### View Logs

```bash
# All logs
fly logs

# Follow logs
fly logs -f

# Specific number of lines
fly logs -n 100
```

### SSH into the Machine

```bash
# Interactive shell
fly ssh console

# View supervisor status
fly ssh console -C "supervisorctl status"

# View specific service logs
fly ssh console -C "tail -100 /var/log/supervisor/api.log"
```

### Restart Services

```bash
# Restart the entire machine
fly machine restart

# Restart specific service via SSH
fly ssh console -C "supervisorctl restart api"
fly ssh console -C "supervisorctl restart cms"
fly ssh console -C "supervisorctl restart web"
fly ssh console -C "supervisorctl restart worker"
```

### Database Operations

```bash
# Connect to PostgreSQL
fly ssh console -C "su - postgres -c 'psql app'"

# Create a database backup
fly ssh console -C "su - postgres -c 'pg_dump app'" > backup-$(date +%Y%m%d).sql

# View database size
fly ssh console -C "su - postgres -c \"psql -c 'SELECT pg_size_pretty(pg_database_size(current_database()))'\""
```

### Update Deployment

```bash
# Pull latest code
git pull

# Re-deploy
fly deploy
```

## Scaling

### Vertical Scaling

Edit `fly.toml` to increase resources:

```toml
[[vm]]
  memory = "4gb"  # Increase memory
  cpu_kind = "shared"
  cpus = 4  # Increase CPUs
```

Then redeploy:

```bash
fly deploy
```

### Increase Volume Size

```bash
fly volumes extend <volume-id> --size 20
```

## Troubleshooting

### Services Not Starting

Check supervisor status and logs:

```bash
fly ssh console -C "supervisorctl status"
fly ssh console -C "cat /var/log/supervisor/cms_err.log"
fly ssh console -C "cat /var/log/supervisor/api_err.log"
```

### Database Issues

```bash
# Check if PostgreSQL is running
fly ssh console -C "supervisorctl status postgres"

# Check PostgreSQL logs
fly ssh console -C "cat /var/log/supervisor/postgres_err.log"

# Test database connection
fly ssh console -C "su - postgres -c 'pg_isready'"
```

### Out of Memory

If services are crashing due to OOM:

1. Check memory usage: `fly ssh console -C "free -m"`
2. Increase VM memory in `fly.toml`
3. Redeploy: `fly deploy`

### Build Failures

```bash
# Build locally first to test
docker build -f Dockerfile.fly -t rah-test .

# Clear Fly.io build cache
fly deploy --no-cache
```

## Custom Domain

```bash
# Add a custom domain
fly certs add yourdomain.com

# View certificate status
fly certs show yourdomain.com
```

Update your DNS to point to your Fly.io app:
- CNAME: `your-app-name.fly.dev`

Then update the secrets with your domain:

```bash
fly secrets set -a your-app-name \
  NEXT_PUBLIC_STRAPI_URL="https://yourdomain.com" \
  NEXT_PUBLIC_API_URL="https://yourdomain.com/api"
```

## Cost Estimation

With the default configuration (2GB RAM, 2 shared CPUs, 10GB volume):
- ~$15-20/month for the VM
- ~$1.50/month for the volume

See [Fly.io Pricing](https://fly.io/docs/about/pricing/) for current rates.
