import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteMarketingEmailStep } from "./steps/marketing-email-crud"

export const deleteMarketingEmailWorkflow = createWorkflow(
  "delete-marketing-email-wf",
  (input: { id: string }) => {
    const result = deleteMarketingEmailStep(input.id)
    return new WorkflowResponse(result)
  }
)
