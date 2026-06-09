import { Module } from "@medusajs/framework/utils"
import ResendMarketingService from "./service"

export const RESEND_MARKETING_MODULE = "resendMarketing"

export default Module(RESEND_MARKETING_MODULE, {
  service: ResendMarketingService,
})
