import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  modules: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              automatic_payment_methods: true,
              capture: true,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM,
            },
          },
        ],
      },
    },
    {
      // Local file storage. Uploads land in apps/backend/static (persisted via a
      // Docker volume — see docker-compose.yml) and are served from BACKEND_URL/static.
      // backend_url MUST be the public HTTPS origin so image URLs work in emails and
      // on the (eventually HTTPS) storefront. BACKEND_URL is plain-HTTP :9000, so we
      // use a dedicated var; at prod cutover set MEDUSA_FILE_BACKEND_URL=https://medusa.strydr.co.uk/static.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              // Absolute so the upload dir is identical whether the container runs
              // `medusa develop` (cwd=/server/apps/backend) or `medusa start`
              // (cwd=.medusa/server). It MUST match the docker-compose volume mount,
              // otherwise uploads won't persist across redeploys. Falls back to a
              // relative "static" for local (non-container) runs.
              upload_dir: process.env.MEDUSA_UPLOAD_DIR || "static",
              backend_url:
                process.env.MEDUSA_FILE_BACKEND_URL ||
                "https://compose-reboot-optical-transmitter-kvvhi-8299f2-69-62-122-190.sslip.io/static",
            },
          },
        ],
      },
    },
    {
      // Royal Mail Click & Drop integration. Auto-pushes paid orders to the
      // user's Click & Drop account on order.placed; a scheduled job syncs
      // tracking back. Disabled gracefully if ROYALMAIL_API_KEY is unset.
      resolve: "./src/modules/royalmail",
      options: {
        api_key: process.env.ROYALMAIL_API_KEY,
        sender_trading_name: process.env.ROYALMAIL_SENDER_NAME || "Strydr",
        ...(process.env.ROYALMAIL_DEFAULT_ITEM_WEIGHT_G
          ? { default_item_weight_g: Number(process.env.ROYALMAIL_DEFAULT_ITEM_WEIGHT_G) }
          : {}),
        ...(process.env.ROYALMAIL_DEFAULT_PACKAGE_FORMAT
          ? { default_package_format: process.env.ROYALMAIL_DEFAULT_PACKAGE_FORMAT }
          : {}),
      },
    },
    {
      // Marketing Email Studio — persists email draft campaigns (name, subject,
      // editor_json, body_html) and tracks send status + Resend broadcast ID.
      resolve: "./src/modules/marketing-email",
    },
    {
      // Resend Audiences/Contacts/Broadcasts for marketing sends.
      // Disabled gracefully if RESEND_API_KEY or RESEND_AUDIENCE_ID is unset.
      resolve: "./src/modules/resend-marketing",
      options: {
        api_key: process.env.RESEND_API_KEY,
        audience_id: process.env.RESEND_AUDIENCE_ID,
        from: process.env.RESEND_MARKETING_FROM || "Strydr <hello@strydr.co.uk>",
      },
    },
    // Redis-backed infrastructure modules. Redis runs in compose (medusa_redis);
    // REDIS_URL is shared (Medusa namespaces its own keys). These make async work
    // durable: without them the event bus + workflow engine are in-memory, so an
    // order's side-effects (confirmation email, Royal Mail push) are lost if the
    // process restarts mid-flight. Sessions already use this Redis.
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: process.env.REDIS_URL,
        jobOptions: {
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 3600, count: 1000 },
        },
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        // `redisUrl` lives inside `redis` (renamed from `url` in v2.12.2).
        redis: { redisUrl: process.env.REDIS_URL },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: { redisUrl: process.env.REDIS_URL },
          },
        ],
      },
    },
  ],
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      ssl: false,
      sslmode: "disable",
    },
    redisUrl: process.env.REDIS_URL,
    workerMode: "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  admin: {
    vite: (config) => ({
      ...config,
      server: {
        ...(config?.server ?? {}),
        allowedHosts: true,
        fs: {
          strict: false,
          allow: ['/'],
        },
      },
    }),
  },
})
