import { MedusaError } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import {
  ClickDropCreateOrder,
  CreateOrdersResponse,
  GetOrderInfoResource,
  PackageFormatIdentifier,
  RoyalMailModuleOptions,
} from "./types"

type InjectedDependencies = {
  logger: Logger
}

const DEFAULT_BASE_URL = "https://api.parcel.royalmail.com/api/v1"

/**
 * Thin wrapper around the Royal Mail Click & Drop REST API.
 * Auth is a raw API key in the `Authorization` header (not a Bearer token).
 * Docs: https://help.parcel.royalmail.com/hc/en-gb/articles/360011462338
 */
export default class RoyalMailService {
  private readonly logger: Logger
  private readonly apiKey?: string
  private readonly baseUrl: string
  readonly defaultItemWeightG: number
  readonly defaultPackageFormat: PackageFormatIdentifier
  readonly senderTradingName?: string

  constructor({ logger }: InjectedDependencies, options: RoyalMailModuleOptions = {}) {
    this.logger = logger
    this.apiKey = options.api_key
    this.baseUrl = (options.base_url || DEFAULT_BASE_URL).replace(/\/$/, "")
    this.defaultItemWeightG = options.default_item_weight_g ?? 200
    this.defaultPackageFormat = options.default_package_format ?? "largeLetter"
    this.senderTradingName = options.sender_trading_name

    if (!this.apiKey) {
      // Don't crash boot — just disable. Calls will throw a clear error.
      this.logger.warn(
        "[royalmail] ROYALMAIL_API_KEY not set — Click & Drop integration is disabled."
      )
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Royal Mail Click & Drop is not configured (missing ROYALMAIL_API_KEY)."
      )
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const text = await res.text()
    const json = text ? safeJson(text) : undefined

    if (!res.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Royal Mail ${method} ${path} failed (${res.status}): ${text || res.statusText}`
      )
    }

    return json as T
  }

  /** Import orders into Click & Drop (max 100 per call). */
  async createOrders(orders: ClickDropCreateOrder[]): Promise<CreateOrdersResponse> {
    return this.request<CreateOrdersResponse>("POST", "/orders", { items: orders })
  }

  /** Delete orders from Click & Drop by identifier (used for workflow rollback). */
  async deleteOrders(identifiers: number[]): Promise<void> {
    if (identifiers.length === 0) {
      return
    }
    await this.request<unknown>("DELETE", `/orders/${identifiers.join(";")}`)
  }

  /** Fetch order info (incl. trackingNumber/shippedOn once labelled) by C&D identifiers. */
  async getOrders(identifiers: number[]): Promise<GetOrderInfoResource[]> {
    if (identifiers.length === 0) {
      return []
    }
    // Royal Mail expects identifiers separated by semicolons in the path.
    const ids = identifiers.join(";")
    const data = await this.request<{ orders?: GetOrderInfoResource[] } | GetOrderInfoResource[]>(
      "GET",
      `/orders/${ids}`
    )
    // The endpoint returns an array; tolerate a wrapped shape too.
    if (Array.isArray(data)) {
      return data
    }
    return data?.orders ?? []
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
