import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { upsertContactStep } from "./steps/resend-marketing"

export const syncContactToAudienceWorkflow = createWorkflow(
  "sync-contact-to-audience-wf",
  ({ order_id }: { order_id: string }) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "email", "shipping_address.first_name"],
      filters: { id: order_id },
      options: { throwIfKeyNotFound: true },
    })

    const result = when({ orders }, (d) => !!d.orders[0]?.email).then(() => {
      const input = transform({ orders }, (d) => ({
        email: d.orders[0].email as string,
        firstName: d.orders[0].shipping_address?.first_name ?? undefined,
      }))
      return upsertContactStep(input)
    })

    return new WorkflowResponse({ result })
  }
)
