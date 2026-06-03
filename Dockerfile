FROM node:20-alpine

WORKDIR /server

RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm@10.11.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/storefront/package.json ./apps/storefront/

RUN pnpm install --no-frozen-lockfile

COPY . .

EXPOSE 9000

COPY start.sh ./start.sh
RUN chmod +x start.sh

ENTRYPOINT ["./start.sh"]
