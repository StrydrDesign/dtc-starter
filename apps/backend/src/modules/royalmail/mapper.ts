import {
  ClickDropAddress,
  ClickDropCreateOrder,
  ClickDropProductItem,
  PackageFormatIdentifier,
} from "./types"

// Medusa money/weight values come through as BigNumberValue (number | string | object).
// Coerce defensively to a plain number.
function num(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "string") return parseFloat(value) || 0
  if (value && typeof value === "object") {
    const n = parseFloat(`${value}`)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

// Royal Mail money fields use 0.01 precision — keep them to 2 dp.
const money = (v: unknown): number => Math.round(num(v) * 100) / 100

type MapperOptions = {
  defaultItemWeightG: number
  defaultPackageFormat: PackageFormatIdentifier
  senderTradingName?: string
}

// Loosely-typed order shape (from useQueryGraphStep) — we only read a subset.
type AnyAddress = {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
}

type AnyItem = {
  product_title?: string | null
  title?: string | null
  variant_title?: string | null
  variant_sku?: string | null
  quantity?: number
  unit_price?: unknown
  variant?: { weight?: number | null } | null
}

// Fields are nullable to match Medusa's `Maybe<T>` (T | null) query-graph types.
export type MappableOrder = {
  display_id?: number | string | null
  email?: string | null
  currency_code?: string | null
  created_at?: string | Date | null
  item_total?: unknown
  shipping_total?: unknown
  tax_total?: unknown
  total?: unknown
  shipping_address?: AnyAddress | null
  billing_address?: AnyAddress | null
  items?: (AnyItem | null)[] | null
}

function toClickDropAddress(addr: AnyAddress): ClickDropAddress {
  const fullName = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim()
  return {
    ...(fullName ? { fullName } : {}),
    ...(addr.company ? { companyName: addr.company } : {}),
    addressLine1: addr.address_1 || "",
    ...(addr.address_2 ? { addressLine2: addr.address_2 } : {}),
    city: addr.city || "",
    ...(addr.province ? { county: addr.province } : {}),
    ...(addr.postal_code ? { postcode: addr.postal_code } : {}),
    countryCode: (addr.country_code || "GB").toUpperCase(),
  }
}

/**
 * Build a Click & Drop CreateOrderRequest from a Medusa order.
 * Pure function — no side effects — so it's easy to unit test.
 */
export function buildClickDropOrder(
  order: MappableOrder,
  options: MapperOptions
): ClickDropCreateOrder {
  const shipping = order.shipping_address
  if (!shipping) {
    throw new Error("Order has no shipping address — cannot push to Royal Mail.")
  }

  const items = (order.items ?? []).filter((it): it is AnyItem => !!it)

  const contents: ClickDropProductItem[] = items.map((it) => {
    const name = [it.product_title || it.title, it.variant_title].filter(Boolean).join(" — ")
    const weight = it.variant?.weight ? Math.round(it.variant.weight) : options.defaultItemWeightG
    return {
      ...(name ? { name: name.slice(0, 800) } : {}),
      ...(it.variant_sku ? { SKU: it.variant_sku.slice(0, 100) } : {}),
      quantity: it.quantity ?? 1,
      unitValue: money(it.unit_price),
      unitWeightInGrams: Math.max(0, weight),
    }
  })

  const packageWeight = contents.reduce(
    (sum, c) => sum + (c.unitWeightInGrams ?? 0) * (c.quantity ?? 1),
    0
  )

  const order_reference = order.display_id != null ? `${order.display_id}`.slice(0, 40) : undefined

  return {
    ...(order_reference ? { orderReference: order_reference } : {}),
    recipient: {
      address: toClickDropAddress(shipping),
      ...(shipping.phone ? { phoneNumber: shipping.phone.slice(0, 25) } : {}),
      ...(order.email ? { emailAddress: order.email.slice(0, 254) } : {}),
    },
    ...(order.billing_address
      ? { billing: { address: toClickDropAddress(order.billing_address) } }
      : {}),
    ...(options.senderTradingName
      ? { sender: { tradingName: options.senderTradingName } }
      : {}),
    packages: [
      {
        // Royal Mail requires 1–30000g; clamp to a safe range.
        weightInGrams: Math.min(30000, Math.max(1, Math.round(packageWeight) || 1)),
        packageFormatIdentifier: options.defaultPackageFormat,
        contents,
      },
    ],
    orderDate: new Date(order.created_at ?? Date.now()).toISOString(),
    subtotal: money(order.item_total),
    shippingCostCharged: money(order.shipping_total),
    total: money(order.total),
    orderTax: money(order.tax_total),
    currencyCode: (order.currency_code || "gbp").toUpperCase().slice(0, 3),
  }
}
