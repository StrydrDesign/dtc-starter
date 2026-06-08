import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types"

// Sample data for the react-email preview server only (not used at runtime).
const HOST =
  "https://compose-reboot-optical-transmitter-kvvhi-8299f2-69-62-122-190.sslip.io/static"

export const sampleOrder = {
  display_id: 1024,
  currency_code: "gbp",
  customer: { first_name: "Alex" },
  email: "alex@example.com",
  item_total: 49.98,
  shipping_total: 5,
  tax_total: 0,
  total: 54.98,
  items: [
    {
      id: "item_1",
      product_title: "Electric Violet Cover",
      variant_title: "Large",
      quantity: 1,
      total: 24.99,
      thumbnail: `${HOST}/1780789391921-IMG_4351.jpg`,
    },
    {
      id: "item_2",
      product_title: "Coral Red Cover",
      variant_title: "Medium",
      quantity: 1,
      total: 24.99,
      thumbnail: `${HOST}/1780789406659-IMG_4405.jpg`,
    },
  ],
  shipping_methods: [{ id: "sm_1", name: "Royal Mail 48", total: 5 }],
  shipping_address: {
    first_name: "Alex",
    last_name: "Morgan",
    address_1: "1 Test Street",
    city: "London",
    postal_code: "SW1A 1AA",
  },
} as unknown as OrderDTO & { customer: CustomerDTO }

export const sampleShippedOrder = {
  ...sampleOrder,
  metadata: { royalmail: { trackingNumber: "AB123456789GB" } },
} as unknown as OrderDTO & { customer: CustomerDTO }
