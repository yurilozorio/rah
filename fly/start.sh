#!/bin/bash
set -e

echo "=== RAH Application Startup ==="

# -----------------------------------------------------------------------------
# Create data directories if they don't exist (volume is empty on first run)
# -----------------------------------------------------------------------------
echo "Ensuring data directories exist..."
mkdir -p /data/postgres /data/uploads /var/log/supervisor /run/postgresql
chown -R postgres:postgres /data/postgres /run/postgresql
chmod 755 /var/log/supervisor /run/postgresql

# -----------------------------------------------------------------------------
# Initialize PostgreSQL if not already initialized
# -----------------------------------------------------------------------------
if [ ! -f /data/postgres/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    su - postgres -c "initdb -D /data/postgres"
    
    # Configure PostgreSQL to accept local connections
    echo "host all all 127.0.0.1/32 md5" >> /data/postgres/pg_hba.conf
    echo "local all all trust" >> /data/postgres/pg_hba.conf
fi

# Ensure correct ownership
chown -R postgres:postgres /data/postgres /run/postgresql
chmod 755 /run/postgresql

# -----------------------------------------------------------------------------
# Start PostgreSQL temporarily for setup
# -----------------------------------------------------------------------------
echo "Starting PostgreSQL for initial setup..."
su - postgres -c "pg_ctl -D /data/postgres -l /run/postgresql/postgres_init.log start"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until su - postgres -c "pg_isready -h 127.0.0.1" > /dev/null 2>&1; do
    sleep 1
done

# -----------------------------------------------------------------------------
# Create database and user if they don't exist
# -----------------------------------------------------------------------------
echo "Setting up database..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\" | grep -q 1" || \
    su - postgres -c "psql -c \"CREATE USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;\""

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\" | grep -q 1" || \
    su - postgres -c "psql -c \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};\""

# Update password in case it changed
su - postgres -c "psql -c \"ALTER USER ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';\""

# -----------------------------------------------------------------------------
# Run Prisma migrations
# -----------------------------------------------------------------------------
echo "Running database migrations..."
cd /app/api
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}?schema=api" \
    npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss || true

# -----------------------------------------------------------------------------
# Ensure uploads directory exists and is linked
# -----------------------------------------------------------------------------
echo "Setting up uploads directory..."
mkdir -p /data/uploads
chmod 777 /data/uploads
rm -rf /app/cms/public/uploads
ln -sf /data/uploads /app/cms/public/uploads
echo "Uploads symlink created: $(ls -la /app/cms/public/uploads)"

# -----------------------------------------------------------------------------
# Stop temporary PostgreSQL (supervisord will manage it)
# -----------------------------------------------------------------------------
echo "Stopping temporary PostgreSQL..."
su - postgres -c "pg_ctl -D /data/postgres stop"

# -----------------------------------------------------------------------------
# Start all services via supervisord
# -----------------------------------------------------------------------------
echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
