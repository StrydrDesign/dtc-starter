import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { RoyalMailOrderMetadata } from "../../modules/royalmail/types"

type Input = {
  order_id: string
  existing_metadata?: Record<string, unknown> | null
  royalmail: RoyalMailOrderMetadata
}

// Merges Royal Mail fields into order.metadata.royalmail without clobbering
// other metadata keys. Compensation restores the previous metadata.
export const updateOrderRoyalmailMetadataStep = createStep(
  "update-order-royalmail-metadata",
  async ({ order_id, existing_metadata, royalmail }: Input, { container }) => {
    const orderModule = container.resolve(Modules.ORDER)

    const prevMetadata = existing_metadata ?? {}
    const prevRoyalmail = (prevMetadata.royalmail as RoyalMailOrderMetadata | undefined) ?? {}

    const metadata = {
      ...prevMetadata,
      royalmail: { ...prevRoyalmail, ...royalmail },
    }

    await orderModule.updateOrders([{ id: order_id, metadata }])

    // Compensation input: enough to restore the prior metadata.
    return new StepResponse(metadata.royalmail, { order_id, metadata: prevMetadata })
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }
    const orderModule = container.resolve(Modules.ORDER)
    await orderModule
      .updateOrders([{ id: compensation.order_id, metadata: compensation.metadata }])
      .catch(() => {})
  }
)
