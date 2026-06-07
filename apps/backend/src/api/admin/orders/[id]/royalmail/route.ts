import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ROYALMAIL_MODULE } from "../../../../../modules/royalmail"
import RoyalMailService from "../../../../../modules/royalmail/service"
import { RoyalMailOrderMetadata } from "../../../../../modules/royalmail/types"
import { pushOrderToRoyalMailWorkflow } from "../../../../../workflows/push-order-to-royalmail"

async function readStoredRoyalmail(
  req: AuthenticatedMedusaRequest
): Promise<RoyalMailOrderMetadata | null> {
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: req.params.id },
  })
  const meta = data?.[0]?.metadata as Record<string, unknown> | undefined
  return (meta?.royalmail as RoyalMailOrderMetadata | undefined) ?? null
}

// POST /admin/orders/:id/royalmail — manually push (or backfill) an order into
// Click & Drop. Idempotent: a no-op if the order was already pushed.
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await pushOrderToRoyalMailWorkflow(req.scope).run({
    input: { order_id: req.params.id },
  })

  const royalmail = await readStoredRoyalmail(req)
  res.json({ order_id: req.params.id, royalmail })
}

// GET /admin/orders/:id/royalmail — live Click & Drop status/tracking for an order.
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const stored = await readStoredRoyalmail(req)

  if (!stored?.orderIdentifier) {
    res.json({ pushed: false, stored: null, clickAndDrop: null })
    return
  }

  const royalmail = req.scope.resolve<RoyalMailService>(ROYALMAIL_MODULE)
  const info = await royalmail.getOrders([stored.orderIdentifier])

  res.json({ pushed: true, stored, clickAndDrop: info[0] ?? null })
}
