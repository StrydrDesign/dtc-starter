import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { updateOrderRoyalmailMetadataStep } from "./steps/update-order-royalmail-metadata"
import { RoyalMailOrderMetadata } from "../modules/royalmail/types"

export type RoyalMailTrackingUpdatedEvent = {
  id: string
  trackingNumber?: string | null
}

type WorkflowInput = {
  order_id: string
  existing_metadata?: Record<string, unknown> | null
  tracking: RoyalMailOrderMetadata
}

// Persists Royal Mail tracking onto an order and emits
// `order.royalmail_tracking_updated` (hook for a future "your order shipped" email).
export const syncRoyalMailTrackingWorkflow = createWorkflow(
  "sync-royalmail-tracking",
  ({ order_id, existing_metadata, tracking }: WorkflowInput) => {
    const royalmail = updateOrderRoyalmailMetadataStep({
      order_id,
      existing_metadata,
      royalmail: tracking,
    })

    emitEventStep({
      eventName: "order.royalmail_tracking_updated",
      data: { id: order_id, trackingNumber: tracking.trackingNumber },
    })

    return new WorkflowResponse({ royalmail })
  }
)
