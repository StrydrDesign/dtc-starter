// Types for the Royal Mail Click & Drop API (subset we use).
// Full spec: https://api.parcel.royalmail.com/doc/v1/click-and-drop-api-v1.yaml

export type PackageFormatIdentifier =
  | "undefined"
  | "letter"
  | "largeLetter"
  | "smallParcel"
  | "mediumParcel"
  | "largeParcel"
  | "parcel"
  | "documents"

export type ClickDropAddress = {
  fullName?: string
  companyName?: string
  addressLine1: string
  addressLine2?: string
  addressLine3?: string
  city: string
  county?: string
  postcode?: string
  countryCode: string
}

export type ClickDropRecipient = {
  address: ClickDropAddress
  phoneNumber?: string
  emailAddress?: string
}

export type ClickDropProductItem = {
  name?: string
  SKU?: string
  quantity: number
  unitValue?: number
  unitWeightInGrams?: number
}

export type ClickDropPackage = {
  weightInGrams: number
  packageFormatIdentifier: PackageFormatIdentifier
  contents?: ClickDropProductItem[]
}

// Body for POST /orders (one order). Only the fields we populate.
export type ClickDropCreateOrder = {
  orderReference?: string
  recipient: ClickDropRecipient
  billing?: { address?: ClickDropAddress; phoneNumber?: string; emailAddress?: string }
  sender?: { tradingName?: string; phoneNumber?: string; emailAddress?: string }
  packages?: ClickDropPackage[]
  orderDate: string
  subtotal: number
  shippingCostCharged: number
  otherCosts?: number
  total: number
  orderTax?: number
  currencyCode?: string
  specialInstructions?: string
}

export type ClickDropCreatedOrder = {
  orderIdentifier: number
  orderReference?: string
  createdOn: string
  orderDate?: string
  printedOn?: string
  manifestedOn?: string
  shippedOn?: string
  trackingNumber?: string
  packages?: { packageNumber: number; trackingNumber?: string }[]
}

export type ClickDropFailedOrder = {
  order?: { orderReference?: string }
  errors?: { code?: string; message?: string; fields?: string[] }[]
  // Royal Mail returns a variety of error shapes; keep it permissive.
  [key: string]: unknown
}

export type CreateOrdersResponse = {
  successCount: number
  errorsCount: number
  createdOrders: ClickDropCreatedOrder[]
  failedOrders: ClickDropFailedOrder[]
}

// GET /orders/{ids} returns a list of these.
export type GetOrderInfoResource = {
  orderIdentifier: number
  orderReference?: string
  createdOn?: string
  orderDate?: string
  printedOn?: string
  manifestedOn?: string
  shippedOn?: string
  trackingNumber?: string
  packages?: { packageNumber: number; trackingNumber?: string }[]
}

export type RoyalMailModuleOptions = {
  api_key?: string
  base_url?: string
  // Fallback weight per line item (grams) when a variant has no weight set.
  default_item_weight_g?: number
  // Click & Drop package format applied to pushed orders (overridable in C&D before buying postage).
  default_package_format?: PackageFormatIdentifier
  // Optional sender trading name surfaced on the Click & Drop order.
  sender_trading_name?: string
}

// Shape we persist on order.metadata.royalmail
export type RoyalMailOrderMetadata = {
  orderIdentifier?: number
  orderReference?: string
  pushedAt?: string
  trackingNumber?: string | null
  shippedOn?: string | null
  printedOn?: string | null
  lastSyncedAt?: string
  lastError?: string
}
