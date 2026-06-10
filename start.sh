#!/bin/sh
set -e

# Production start. `medusa start` resolves the project root from CWD (it does NOT
# chdir into .medusa/server itself), and serves the admin from <cwd>/public/admin.
# `medusa build` writes the admin to .medusa/server/public/admin, so we MUST run
# from .medusa/server — otherwise the server looks at apps/backend/public/admin,
# which doesn't exist, and crashes with "Could not find index.html".
# Deps resolve upward from apps/backend/node_modules (the pnpm install).
MEDUSA="/server/apps/backend/node_modules/.bin/medusa"
cd /server/apps/backend/.medusa/server

echo "Running database migrations..."
"$MEDUSA" db:migrate

if [ -n "$MEDUSA_ADMIN_EMAIL" ] && [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "Creating admin user $MEDUSA_ADMIN_EMAIL..."
  "$MEDUSA" user -e "$MEDUSA_ADMIN_EMAIL" -p "$MEDUSA_ADMIN_PASSWORD" 2>&1 \
    || echo "Admin user already exists, continuing."
fi

echo "Starting Medusa from .medusa/server (cwd serves public/admin)..."
exec "$MEDUSA" start
