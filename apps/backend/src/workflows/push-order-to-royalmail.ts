import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { createClickDropOrderStep } from "./steps/create-click-drop-order"
import { updateOrderRoyalmailMetadataStep } from "./steps/update-order-royalmail-metadata"

type WorkflowInput = {
  order_id: string
}

// Pushes a paid Medusa order into Royal Mail Click & Drop, then records the
// returned C&D order identifier on order.metadata.royalmail. Idempotent: a
// re-run skips orders that already carry an orderIdentifier.
export const pushOrderToRoyalMailWorkflow = createWorkflow(
  "push-order-to-royalmail",
  ({ order_id }: WorkflowInput) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "created_at",
        "metadata",
        "item_total",
        "shipping_total",
        "tax_total",
        "total",
        "shipping_address.*",
        "billing_address.*",
        "items.*",
        "items.variant.sku",
        "items.variant.weight",
      ],
      filters: { id: order_id },
      options: { throwIfKeyNotFound: true },
    })

    const result = when({ orders }, (data) => {
      const order = data.orders?.[0] as
        | { shipping_address?: unknown; metadata?: { royalmail?: { orderIdentifier?: number } } }
        | undefined
      return (
        !!order &&
        !!order.shipping_address &&
        !order.metadata?.royalmail?.orderIdentifier
      )
    }).then(() => {
      const created = createClickDropOrderStep({ order: orders[0] })

      const royalmail = transform({ created }, (data) => ({
        orderIdentifier: data.created.orderIdentifier,
        orderReference: data.created.orderReference,
        trackingNumber: data.created.trackingNumber ?? null,
        pushedAt: new Date().toISOString(),
      }))

      const updated = updateOrderRoyalmailMetadataStep({
        order_id,
        existing_metadata: orders[0].metadata,
        royalmail,
      })

      return updated
    })

    return new WorkflowResponse({ royalmail: result })
  }
)
