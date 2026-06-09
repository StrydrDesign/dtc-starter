import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendMarketingBroadcastStep } from "./steps/resend-marketing"
import { updateMarketingEmailStep } from "./steps/marketing-email-crud"

export const sendMarketingBroadcastWorkflow = createWorkflow(
  "send-marketing-broadcast-wf",
  ({ id }: { id: string }) => {
    const { data: rows } = useQueryGraphStep({
      entity: "marketing_email",
      fields: ["id", "name", "subject", "preheader", "body_html"],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })

    // Mark sending; if the send step throws BEFORE Resend accepts it, this
    // step's compensation reverts the status to draft.
    updateMarketingEmailStep({ id, status: "sending" }).config({ name: "mark-sending" })

    const payload = transform({ rows, id }, (d) => ({
      id: d.id,
      name: d.rows[0].name,
      subject: d.rows[0].subject,
      body_html: d.rows[0].body_html ?? "",
      preheader: d.rows[0].preheader ?? undefined,
    }))

    const sent = sendMarketingBroadcastStep(payload)

    return new WorkflowResponse(sent)
  }
)
