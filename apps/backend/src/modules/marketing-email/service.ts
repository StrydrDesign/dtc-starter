import { MedusaService } from "@medusajs/framework/utils"
import MarketingEmail from "./models/marketing-email"

class MarketingEmailService extends MedusaService({ MarketingEmail }) {}

export default MarketingEmailService
