import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MARKETING_EMAIL_MODULE } from "../../../modules/marketing-email"
import MarketingEmailService from "../../../modules/marketing-email/service"

type CreateInput = { name: string; subject: string; preheader?: string }

export const createMarketingEmailStep = createStep(
  "create-marketing-email",
  async (input: CreateInput, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    const created = await svc.createMarketingEmails(input)
    return new StepResponse(created, created.id)
  },
  async (id, { container }) => {
    if (!id) return
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.deleteMarketingEmails(id)
  }
)

type UpdateInput = {
  id: string
  name?: string
  subject?: string
  preheader?: string | null
  editor_json?: Record<string, unknown> | null
  body_html?: string
  status?: "draft" | "sending" | "sent"
  resend_broadcast_id?: string
  sent_at?: Date
}

export const updateMarketingEmailStep = createStep(
  "update-marketing-email",
  async (input: UpdateInput, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    const before = await svc.retrieveMarketingEmail(input.id)
    const updated = await svc.updateMarketingEmails(input)
    return new StepResponse(updated, before)
  },
  async (before, { container }) => {
    if (!before) return
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.updateMarketingEmails({
      id: before.id,
      status: before.status,
      resend_broadcast_id: before.resend_broadcast_id ?? undefined,
      sent_at: before.sent_at ?? undefined,
    })
  }
)

export const deleteMarketingEmailStep = createStep(
  "delete-marketing-email",
  async (id: string, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.deleteMarketingEmails(id)
    return new StepResponse({ id })
  }
)
