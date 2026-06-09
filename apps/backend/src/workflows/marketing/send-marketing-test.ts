import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendMarketingTestStep } from "./steps/resend-marketing"

type Input = { id: string; to: string }

export const sendMarketingTestWorkflow = createWorkflow(
  "send-marketing-test-wf",
  ({ id, to }: Input) => {
    const { data: rows } = useQueryGraphStep({
      entity: "marketing_email",
      fields: ["id", "subject", "preheader", "body_html"],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })
    const payload = transform({ rows, to }, (d) => ({
      to: d.to,
      subject: d.rows[0].subject,
      body_html: d.rows[0].body_html ?? "",
      preheader: d.rows[0].preheader ?? undefined,
    }))
    const result = sendMarketingTestStep(payload)
    return new WorkflowResponse(result)
  }
)
