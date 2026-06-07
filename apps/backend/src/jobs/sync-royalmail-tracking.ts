import { MedusaContainer } from "@medusajs/framework/types"
import { ROYALMAIL_MODULE } from "../modules/royalmail"
import RoyalMailService from "../modules/royalmail/service"
import { RoyalMailOrderMetadata } from "../modules/royalmail/types"
import { syncRoyalMailTrackingWorkflow } from "../workflows/sync-royalmail-tracking"

// Polls Click & Drop for orders we pushed but that don't yet have a tracking
// number, and writes back tracking once labels are generated in C&D.
export default async function syncRoyalMailTrackingJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const royalmail = container.resolve<RoyalMailService>(ROYALMAIL_MODULE)

  if (!royalmail.isConfigured()) {
    return
  }

  const query = container.resolve("query")

  try {
    // Look back 60 days — plenty for an order to be labelled & dispatched.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { created_at: { $gte: since } },
      pagination: { take: 1000, order: { created_at: "DESC" } },
    })

    // Orders pushed to C&D but still awaiting a tracking number.
    type PendingOrder = {
      order_id: string
      metadata: Record<string, unknown>
      identifier: number
    }

    const pending: PendingOrder[] = orders
      .map((o: { id: string; metadata?: Record<string, unknown> | null }): PendingOrder | null => {
        const rm = o.metadata?.royalmail as RoyalMailOrderMetadata | undefined
        return rm?.orderIdentifier && !rm.trackingNumber
          ? { order_id: o.id, metadata: o.metadata ?? {}, identifier: rm.orderIdentifier }
          : null
      })
      .filter((x: PendingOrder | null): x is PendingOrder => x !== null)

    if (pending.length === 0) {
      return
    }

    const byIdentifier = new Map<number, PendingOrder>(pending.map((p) => [p.identifier, p]))

    // Batch the lookup (Click & Drop accepts many identifiers per call; cap at 100).
    let updated = 0
    for (let i = 0; i < pending.length; i += 100) {
      const batch = pending.slice(i, i + 100).map((p) => p.identifier)
      const results = await royalmail.getOrders(batch)

      for (const r of results) {
        if (!r.trackingNumber) {
          continue
        }
        const match = byIdentifier.get(r.orderIdentifier)
        if (!match) {
          continue
        }

        const tracking: RoyalMailOrderMetadata = {
          trackingNumber: r.trackingNumber,
          shippedOn: r.shippedOn ?? null,
          printedOn: r.printedOn ?? null,
          lastSyncedAt: new Date().toISOString(),
        }

        await syncRoyalMailTrackingWorkflow(container).run({
          input: { order_id: match.order_id, existing_metadata: match.metadata, tracking },
        })
        updated++
      }
    }

    if (updated > 0) {
      logger.info(`[royalmail] tracking sync updated ${updated} order(s)`)
    }
  } catch (e) {
    logger.error(
      `[royalmail] tracking sync failed: ${e instanceof Error ? e.message : e}`
    )
  }
}

export const config = {
  name: "sync-royalmail-tracking",
  schedule: "*/30 * * * *", // every 30 minutes
}
