import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_EMAIL_MODULE } from "../../../modules/marketing-email"
import MarketingEmailService from "../../../modules/marketing-email/service"
import { createMarketingEmailWorkflow } from "../../../workflows/marketing/create-marketing-email"
import { CreateMarketingEmailSchema } from "./validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
  const [emails, count] = await svc.listAndCountMarketingEmails(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ marketing_emails: emails, count })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = CreateMarketingEmailSchema.parse(req.body)
  const { result } = await createMarketingEmailWorkflow(req.scope).run({ input: body })
  res.status(201).json({ marketing_email: result.email })
}
