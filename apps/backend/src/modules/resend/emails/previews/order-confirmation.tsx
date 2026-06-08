// react-email preview entry (dev-only). Run: pnpm email:preview
import { orderPlacedEmail } from "../order-placed"
import { sampleOrder } from "./_sample"

export default function OrderConfirmationPreview() {
  return orderPlacedEmail({ order: sampleOrder })
}
