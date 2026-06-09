import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendMarketingBroadcastWorkflow } from "../../../../../workflows/marketing/send-marketing-broadcast"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await sendMarketingBroadcastWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ sent: true, broadcast_id: result.broadcastId })
}
