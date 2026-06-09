import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createMarketingEmailStep } from "./steps/marketing-email-crud"

type Input = { name: string; subject: string; preheader?: string }

export const createMarketingEmailWorkflow = createWorkflow(
  "create-marketing-email-wf",
  (input: Input) => {
    const email = createMarketingEmailStep(input)
    return new WorkflowResponse({ email })
  }
)
