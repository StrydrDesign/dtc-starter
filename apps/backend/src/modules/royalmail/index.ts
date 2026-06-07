import { Module } from "@medusajs/framework/utils"
import RoyalMailService from "./service"

export const ROYALMAIL_MODULE = "royalmail"

export default Module(ROYALMAIL_MODULE, {
  service: RoyalMailService,
})
