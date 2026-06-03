#!/bin/sh
set -e
cd /server/apps/backend

echo "Running database migrations..."
pnpm medusa db:migrate

if [ -n "$MEDUSA_ADMIN_EMAIL" ] && [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "Creating admin user $MEDUSA_ADMIN_EMAIL..."
  pnpm medusa user -e "$MEDUSA_ADMIN_EMAIL" -p "$MEDUSA_ADMIN_PASSWORD" 2>&1 || echo "Admin user already exists, continuing."
fi

echo "Starting Medusa..."
exec pnpm medusa start
