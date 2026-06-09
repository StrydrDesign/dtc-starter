#!/bin/sh
set -e
cd /server/apps/backend

echo "Running database migrations..."
pnpm medusa db:migrate

if [ -n "$MEDUSA_ADMIN_EMAIL" ] && [ -n "$MEDUSA_ADMIN_PASSWORD" ]; then
  echo "Creating admin user $MEDUSA_ADMIN_EMAIL..."
  pnpm medusa user -e "$MEDUSA_ADMIN_EMAIL" -p "$MEDUSA_ADMIN_PASSWORD" 2>&1 || echo "Admin user already exists, continuing."
fi

echo "=== BUILD OUTPUT CHECK ==="
ls /server/apps/backend/.medusa/client/index.html 2>/dev/null && echo "FOUND: admin at backend dir" || echo "MISSING: admin at backend dir"
ls /server/.medusa/client/index.html 2>/dev/null && echo "FOUND: admin at workspace root" || echo "MISSING: admin at workspace root"
ls /server/apps/backend/.medusa/server/ 2>/dev/null | head -5 || echo "MISSING: server at backend dir"
echo "==========================="

echo "Starting Medusa..."
exec pnpm start
