import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_EMAIL_MODULE } from "../../../../modules/marketing-email"
import MarketingEmailService from "../../../../modules/marketing-email/service"
import { updateMarketingEmailWorkflow } from "../../../../workflows/marketing/update-marketing-email"
import { deleteMarketingEmailWorkflow } from "../../../../workflows/marketing/delete-marketing-email"
import { UpdateMarketingEmailSchema } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
  const email = await svc.retrieveMarketingEmail(req.params.id)
  res.json({ marketing_email: email })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = UpdateMarketingEmailSchema.parse(req.body)
  const { result } = await updateMarketingEmailWorkflow(req.scope).run({
    input: { id: req.params.id, ...body },
  })
  res.json({ marketing_email: result.email })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteMarketingEmailWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "marketing_email", deleted: true })
}
