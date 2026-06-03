#!/bin/sh
set -e
cd /server/apps/backend

echo "Running database migrations..."
pnpm medusa db:migrate

echo "Starting Medusa..."
exec pnpm dev
