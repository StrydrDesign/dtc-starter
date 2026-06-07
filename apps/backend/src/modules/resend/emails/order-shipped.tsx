import {
  Text,
  Column,
  Container,
  Heading,
  Html,
  Img,
  Row,
  Section,
  Button,
  Tailwind,
  Head,
  Preview,
  Body,
} from "@react-email/components"
import { CustomerDTO, OrderDTO } from "@medusajs/framework/types"

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
    <Tailwind>
      <Html className="font-sans bg-gray-100">
        <Head />
        <Preview>Your Strydr order is on its way</Preview>
        <Body className="bg-white my-10 mx-auto w-full max-w-2xl">
          {/* Header */}
          <Section className="bg-[#222222] px-6 py-5">
            <Text className="m-0 text-2xl font-bold tracking-tight">
              <span className="text-white">stry</span>
              <span className="text-[#4cc04b]">dr</span>
            </Text>
          </Section>

          {/* Heading */}
          <Container className="p-6">
            <Heading className="text-2xl font-bold text-center text-gray-800">
              Your order is on its way, {firstName}
            </Heading>
            <Text className="text-center text-gray-600 mt-2">
              Good news — your Strydr order
              {order.display_id ? ` (#${order.display_id})` : ""} has been
              dispatched with Royal Mail.
            </Text>
          </Container>

          {/* Tracking */}
          {trackingNumber && (
            <Container className="px-6">
              <Section className="bg-gray-50 rounded-2xl px-6 py-5 text-center">
                <Text className="m-0 text-sm uppercase tracking-wide text-gray-500">
                  Tracking number
                </Text>
                <Text className="m-0 mt-1 text-lg font-bold text-gray-800">
                  {trackingNumber}
                </Text>
                {trackingUrl && (
                  <Button
                    href={trackingUrl}
                    className="mt-4 inline-block rounded-full bg-[#4cc04b] px-6 py-3 text-sm font-semibold text-white"
                  >
                    Track your parcel
                  </Button>
                )}
              </Section>
            </Container>
          )}

          {/* Items */}
          <Container className="px-6">
            <Heading className="text-xl font-semibold text-gray-800 mb-4 mt-2">
              What&apos;s on the way
            </Heading>
            {order.items?.map((item) => (
              <Section key={item.id} className="border-b border-gray-200 py-4">
                <Row>
                  <Column className="w-1/4">
                    <Img
                      src={item.thumbnail ?? ""}
                      alt={item.product_title ?? ""}
                      className="rounded-lg"
                      width="100%"
                    />
                  </Column>
                  <Column className="w-3/4 pl-4">
                    <Text className="text-base font-semibold text-gray-800 m-0">
                      {item.product_title}
                    </Text>
                    <Text className="text-gray-600 m-0">{item.variant_title}</Text>
                    <Text className="text-gray-600 text-sm m-0 mt-1">
                      Qty: {item.quantity}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </Container>

          {/* Delivery address */}
          {address && (
            <Container className="px-6 mt-6">
              <Heading className="text-base font-semibold text-gray-800 mb-2">
                Delivery address
              </Heading>
              <Text className="text-gray-600 text-sm m-0">
                {[address.first_name, address.last_name].filter(Boolean).join(" ")}
              </Text>
              <Text className="text-gray-600 text-sm m-0">{address.address_1}</Text>
              {address.address_2 && (
                <Text className="text-gray-600 text-sm m-0">{address.address_2}</Text>
              )}
              <Text className="text-gray-600 text-sm m-0">
                {[address.city, address.postal_code].filter(Boolean).join(", ")}
              </Text>
            </Container>
          )}

          {/* Footer */}
          <Section className="bg-gray-50 p-6 mt-10">
            <Text className="text-center text-gray-500 text-sm">
              Questions about your order? Just reply to this email.
            </Text>
            <Text className="text-center text-gray-400 text-xs mt-4">
              © {new Date().getFullYear()} Strydr. All rights reserved.
            </Text>
          </Section>
        </Body>
      </Html>
    </Tailwind>
  )
}

export const orderShippedEmail = (props: OrderShippedEmailProps) => (
  <OrderShippedEmailComponent {...props} />
)
