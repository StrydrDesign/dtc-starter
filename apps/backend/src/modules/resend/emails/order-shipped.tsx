import {
  Text,
  Button,
  Column,
  Container,
  Heading,
  Img,
  Row,
  Section,
} from "@react-email/components"
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types"
import { EmailLayout, Eyebrow } from "./components/brand"

type OrderShippedEmailProps = {
  order: OrderDTO & {
    customer?: CustomerDTO
  }
}

function trackingFromOrder(order: OrderDTO): string | null {
  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const rm = (meta.royalmail ?? {}) as Record<string, unknown>
  const t = rm.trackingNumber
  return typeof t === "string" && t.length > 0 ? t : null
}

function OrderShippedEmailComponent({ order }: OrderShippedEmailProps) {
  const firstName =
    order.customer?.first_name || order.shipping_address?.first_name || "there"

  const trackingNumber = trackingFromOrder(order)
  const trackingUrl = trackingNumber
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`
    : null

  const address = order.shipping_address

  return (
    <EmailLayout preview="Your Strydr order is on its way">
      {/* Intro */}
      <Container className="px-8 pt-8">
        <Eyebrow>On its way</Eyebrow>
        <Heading className="m-0 mt-2 font-heading text-[26px] font-bold tracking-[-0.01em] text-ink">
          Your order is on its way, {firstName}
        </Heading>
        <Text className="mb-0 mt-3 font-sans text-[15px] leading-[1.55] text-body">
          Good news — order #{order.display_id} has been dispatched with Royal
          Mail.
        </Text>
      </Container>

      {/* Tracking */}
      {trackingNumber && (
        <Container className="px-8 pt-6">
          <Section className="rounded-[20px] bg-panel px-6 py-7 text-center">
            <Text className="m-0 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">
              Tracking number
            </Text>
            <Text className="m-0 mt-2 font-heading text-[20px] font-bold tracking-[0.02em] text-ink">
              {trackingNumber}
            </Text>
            {trackingUrl && (
              <Button
                href={trackingUrl}
                className="mt-5 rounded-full bg-green px-7 py-3.5 font-heading text-[15px] font-semibold text-onGreen"
              >
                Track Your Parcel
              </Button>
            )}
          </Section>
        </Container>
      )}

      {/* Items */}
      <Container className="px-8 pt-6">
        <Text className="m-0 mb-2 font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
          What&apos;s on the way
        </Text>
        <Section className="rounded-[20px] bg-panel p-2">
          {order.items?.map((item) => (
            <Section key={item.id} className="px-3 py-3">
              <Row>
                <Column className="w-[64px] align-top">
                  <Img
                    src={item.thumbnail ?? ""}
                    alt={item.product_title ?? ""}
                    width="56"
                    height="56"
                    className="rounded-[12px]"
                    style={{ objectFit: "cover" }}
                  />
                </Column>
                <Column className="pl-4 align-top">
                  <Text className="m-0 font-heading text-[15px] font-semibold text-ink">
                    {item.product_title}
                  </Text>
                  <Text className="m-0 font-sans text-[13px] text-body">
                    {[item.variant_title, `Qty ${item.quantity}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}
        </Section>
      </Container>

      {/* Delivery address */}
      {address && (
        <Container className="px-8 pb-9 pt-6">
          <Eyebrow>Delivering to</Eyebrow>
          <Text className="m-0 mt-2 font-sans text-[14px] leading-[1.5] text-body">
            {[address.first_name, address.last_name].filter(Boolean).join(" ")}
            <br />
            {address.address_1}
            {address.address_2 ? (
              <>
                <br />
                {address.address_2}
              </>
            ) : null}
            <br />
            {[address.city, address.postal_code].filter(Boolean).join(", ")}
          </Text>
        </Container>
      )}
    </EmailLayout>
  )
}

export const orderShippedEmail = (props: OrderShippedEmailProps) => (
  <OrderShippedEmailComponent {...props} />
)
