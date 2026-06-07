import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ROYALMAIL_MODULE } from "../modules/royalmail"
import RoyalMailService from "../modules/royalmail/service"
import { pushOrderToRoyalMailWorkflow } from "../workflows/push-order-to-royalmail"

// Auto-imports each paid order into Royal Mail Click & Drop. Runs independently
// of the order-confirmation email subscriber; failures are logged, never thrown,
// so a Royal Mail outage can't block order placement.
export default async function orderPlacedRoyalMailHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const royalmail = container.resolve<RoyalMailService>(ROYALMAIL_MODULE)

  if (!royalmail.isConfigured()) {
    return
  }

  try {
    await pushOrderToRoyalMailWorkflow(container).run({
      input: { order_id: data.id },
    })
    logger.info(`[royalmail] pushed order ${data.id} to Click & Drop`)
  } catch (e) {
    logger.error(
      `[royalmail] failed to push order ${data.id} to Click & Drop: ${
        e instanceof Error ? e.message : e
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
