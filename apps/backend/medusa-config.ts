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
