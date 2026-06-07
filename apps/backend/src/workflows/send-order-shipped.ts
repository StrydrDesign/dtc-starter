import {
  createWorkflow,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendNotificationStep } from "./steps/send-notification"

type WorkflowInput = {
  id: string
}

// Sends the "your order is on its way" email. Triggered once Royal Mail
// tracking is synced onto the order (order.royalmail_tracking_updated).
export const sendOrderShippedWorkflow = createWorkflow(
  "send-order-shipped",
  ({ id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "metadata",
        "items.*",
        "shipping_address.*",
        "customer.*",
      ],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })

    const notification = when({ orders }, (data) => !!data.orders[0].email).then(
      () => {
        return sendNotificationStep([
          {
            to: orders[0].email!,
            channel: "email",
            template: "order-shipped",
            data: {
              order: orders[0],
            },
          },
        ])
      }
    )

    return new WorkflowResponse({ notification })
  }
)
