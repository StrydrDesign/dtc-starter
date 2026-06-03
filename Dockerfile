FROM node:20-alpine

WORKDIR /server

RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm@10.11.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

RUN pnpm install --no-frozen-lockfile

COPY . .

# Build Medusa (admin + server) at image build time so production mode has static files
# Placeholder DB/secret values are fine here — build step never connects to the database
RUN cd apps/backend && \
    NODE_ENV=production \
    DATABASE_URL="postgres://build:build@localhost:5432/medusa" \
    JWT_SECRET="build-placeholder-secret-32chars-minimum-ok" \
    COOKIE_SECRET="build-placeholder-secret-32chars-minimum-ok" \
    NODE_OPTIONS="--max-old-space-size=3072" \
    pnpm medusa build

EXPOSE 9000

COPY start.sh ./start.sh
RUN chmod +x start.sh

ENTRYPOINT ["./start.sh"]
