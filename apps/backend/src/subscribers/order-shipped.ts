import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendOrderShippedWorkflow } from "../workflows/send-order-shipped"

// Sends the "your order is on its way" email when Royal Mail tracking is synced
// onto an order. Error-isolated so an email failure can't disrupt the sync job.
export default async function orderShippedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; trackingNumber?: string | null }>) {
  if (!data.trackingNumber) {
    return
  }

  const logger = container.resolve("logger")

  try {
    await sendOrderShippedWorkflow(container).run({
      input: { id: data.id },
    })
    logger.info(`[royalmail] sent shipped email for order ${data.id}`)
  } catch (e) {
    logger.error(
      `[royalmail] failed to send shipped email for order ${data.id}: ${
        e instanceof Error ? e.message : e
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.royalmail_tracking_updated",
}
