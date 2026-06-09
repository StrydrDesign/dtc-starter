import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { RESEND_MARKETING_MODULE } from "../modules/resend-marketing"
import ResendMarketingService from "../modules/resend-marketing/service"
import { syncContactToAudienceWorkflow } from "../workflows/marketing/sync-contact-to-audience"

// Adds the buyer to the Resend marketing audience on order placement.
// Error-isolated; no-op when marketing isn't configured.
export default async function orderPlacedAudienceHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const marketing = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
  if (!marketing.isConfigured()) {
    return
  }
  try {
    await syncContactToAudienceWorkflow(container).run({ input: { order_id: data.id } })
    logger.info(`[resend-marketing] synced order ${data.id} buyer to audience`)
  } catch (e) {
    logger.error(
      `[resend-marketing] audience sync failed for order ${data.id}: ${
        e instanceof Error ? e.message : e
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
