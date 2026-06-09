import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RESEND_MARKETING_MODULE } from "../../../modules/resend-marketing"
import ResendMarketingService from "../../../modules/resend-marketing/service"
import { wrapMarketingHtml } from "../../../modules/resend/emails/marketing-shell"
import { MARKETING_EMAIL_MODULE } from "../../../modules/marketing-email"
import MarketingEmailService from "../../../modules/marketing-email/service"

export const upsertContactStep = createStep(
  "upsert-marketing-contact",
  async (input: { email: string; firstName?: string }, { container }) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    await svc.upsertContact(input)
    return new StepResponse({ ok: true })
  }
)

export const sendMarketingTestStep = createStep(
  "send-marketing-test",
  async (
    input: { to: string; subject: string; body_html: string; preheader?: string },
    { container }
  ) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    const html = wrapMarketingHtml(input.body_html, { preheader: input.preheader })
    const id = await svc.sendTest({ to: input.to, subject: input.subject, html })
    return new StepResponse({ id })
  }
)

export const sendMarketingBroadcastStep = createStep(
  "send-marketing-broadcast",
  async (
    input: { id: string; name: string; subject: string; body_html: string; preheader?: string },
    { container }
  ) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    const html = wrapMarketingHtml(input.body_html, { preheader: input.preheader })
    const broadcastId = await svc.createAndSendBroadcast({
      name: input.name,
      subject: input.subject,
      previewText: input.preheader,
      html,
    })
    // The send is irreversible — record 'sent' in the SAME step so no later
    // compensation can roll the status back to draft and risk a double-send.
    const emails = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await emails
      .updateMarketingEmails({
        id: input.id,
        status: "sent",
        resend_broadcast_id: broadcastId,
        sent_at: new Date(),
      })
      .catch(() => {
        // Send already succeeded; a bookkeeping failure must not fail the step.
      })
    return new StepResponse({ broadcastId })
  }
)
