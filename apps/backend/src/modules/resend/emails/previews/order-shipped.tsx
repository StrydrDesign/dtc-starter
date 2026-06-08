// react-email preview entry (dev-only). Run: pnpm email:preview
import { orderShippedEmail } from "../order-shipped"
import { sampleShippedOrder } from "./_sample"

export default function OrderShippedPreview() {
  return orderShippedEmail({ order: sampleShippedOrder })
}
