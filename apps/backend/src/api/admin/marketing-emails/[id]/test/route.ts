import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendMarketingTestWorkflow } from "../../../../../workflows/marketing/send-marketing-test"
import { TestSendSchema } from "../../validators"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { to } = TestSendSchema.parse(req.body)
  const { result } = await sendMarketingTestWorkflow(req.scope).run({
    input: { id: req.params.id, to },
  })
  res.json({ sent: true, id: result.id })
}
