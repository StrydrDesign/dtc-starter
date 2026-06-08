import {
  Text,
  Column,
  Container,
  Heading,
  Img,
  Row,
  Section,
} from "@react-email/components"
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types"
import { EmailLayout, Eyebrow, formatPrice } from "./components/brand"

type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer?: CustomerDTO
  }
}

function OrderPlacedEmailComponent({ order }: OrderPlacedEmailProps) {
  const currency = order.currency_code
  const price = (v: Parameters<typeof formatPrice>[0]) => formatPrice(v, currency)

  const firstName =
    order.customer?.first_name || order.shipping_address?.first_name || "there"
  const taxTotal = parseFloat(`${order.tax_total ?? 0}`)
  const address = order.shipping_address

  return (
    <EmailLayout preview={`Order #${order.display_id} confirmed — thank you`}>
      {/* Intro */}
      <Container className="px-8 pt-8">
        <Eyebrow>Order confirmed</Eyebrow>
        <Heading className="m-0 mt-2 font-heading text-[26px] font-bold tracking-[-0.01em] text-ink">
          Thank you, {firstName}
        </Heading>
        <Text className="mb-0 mt-3 font-sans text-[15px] leading-[1.55] text-body">
          We&apos;re getting your crutch covers ready and will let you know the
          moment they ship.
        </Text>
      </Container>

      {/* Items */}
      <Container className="px-8 pt-6">
        <Text className="m-0 mb-2 font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
          Order #{order.display_id}
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
                <Column className="align-top text-right">
                  <Text className="m-0 font-heading text-[15px] font-bold text-ink">
                    {price(item.total)}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}
        </Section>
      </Container>

      {/* Summary */}
      <Container className="px-8 pt-4">
        <Section className="rounded-[20px] bg-panel px-5 py-4">
          <Row>
            <Column>
              <Text className="m-0 py-1 font-sans text-[14px] text-body">Subtotal</Text>
            </Column>
            <Column className="text-right">
              <Text className="m-0 py-1 font-sans text-[14px] text-body">
                {price(order.item_total)}
              </Text>
            </Column>
          </Row>
          {order.shipping_methods?.map((method) => (
            <Row key={method.id}>
              <Column>
                <Text className="m-0 py-1 font-sans text-[14px] text-body">
                  {method.name}
                </Text>
              </Column>
              <Column className="text-right">
                <Text className="m-0 py-1 font-sans text-[14px] text-body">
                  {price(method.total)}
                </Text>
              </Column>
            </Row>
          ))}
          {taxTotal > 0 && (
            <Row>
              <Column>
                <Text className="m-0 py-1 font-sans text-[14px] text-body">Tax</Text>
              </Column>
              <Column className="text-right">
                <Text className="m-0 py-1 font-sans text-[14px] text-body">
                  {price(taxTotal)}
                </Text>
              </Column>
            </Row>
          )}
          <Row>
            <Column>
              <Text className="m-0 mt-2 font-heading text-[18px] font-bold text-ink">
                Total
              </Text>
            </Column>
            <Column className="text-right">
              <Text className="m-0 mt-2 font-heading text-[18px] font-bold text-ink">
                {price(order.total)}
              </Text>
            </Column>
          </Row>
        </Section>
      </Container>

      {/* Shipping address */}
      {address && (
        <Container className="px-8 pb-9 pt-6">
          <Eyebrow>Shipping to</Eyebrow>
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

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
)
