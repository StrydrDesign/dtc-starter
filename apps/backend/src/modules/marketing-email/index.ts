import { Module } from "@medusajs/framework/utils"
import MarketingEmailService from "./service"

export const MARKETING_EMAIL_MODULE = "marketingEmail"

export default Module(MARKETING_EMAIL_MODULE, {
  service: MarketingEmailService,
})
