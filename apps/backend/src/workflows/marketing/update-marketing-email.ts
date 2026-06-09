import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateMarketingEmailStep } from "./steps/marketing-email-crud"

type Input = {
  id: string
  name?: string
  subject?: string
  preheader?: string | null
  editor_json?: Record<string, unknown> | null
  body_html?: string
}

export const updateMarketingEmailWorkflow = createWorkflow(
  "update-marketing-email-wf",
  (input: Input) => {
    const email = updateMarketingEmailStep(input)
    return new WorkflowResponse({ email })
  }
)
