import { model } from "@medusajs/framework/utils"

const MarketingEmail = model.define("marketing_email", {
  id: model.id().primaryKey(),
  name: model.text(),
  subject: model.text(),
  preheader: model.text().nullable(),
  editor_json: model.json().nullable(),
  body_html: model.text().nullable(),
  status: model.enum(["draft", "sending", "sent"]).default("draft"),
  resend_broadcast_id: model.text().nullable(),
  sent_at: model.dateTime().nullable(),
})

export default MarketingEmail
