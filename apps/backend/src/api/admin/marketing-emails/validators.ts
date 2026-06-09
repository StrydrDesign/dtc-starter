import { z } from "zod"

export const CreateMarketingEmailSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  preheader: z.string().optional(),
})
export type CreateMarketingEmailBody = z.infer<typeof CreateMarketingEmailSchema>

export const UpdateMarketingEmailSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  preheader: z.string().nullable().optional(),
  editor_json: z.any().optional(),
  body_html: z.string().optional(),
})
export type UpdateMarketingEmailBody = z.infer<typeof UpdateMarketingEmailSchema>

export const TestSendSchema = z.object({ to: z.string().email() })
export type TestSendBody = z.infer<typeof TestSendSchema>
