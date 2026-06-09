import { MedusaError } from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { Resend } from "resend"

type Options = { api_key?: string; audience_id?: string; from?: string }
type InjectedDependencies = { logger: Logger }

const DEFAULT_FROM = "Strydr <hello@strydr.co.uk>"

/** Wraps the Resend Audiences/Contacts/Broadcasts API for marketing sends. */
export default class ResendMarketingService {
  private readonly logger: Logger
  private readonly client?: Resend
  private readonly audienceId?: string
  readonly from: string

  constructor({ logger }: InjectedDependencies, options: Options = {}) {
    this.logger = logger
    this.audienceId = options.audience_id
    this.from = options.from || DEFAULT_FROM
    if (options.api_key) {
      this.client = new Resend(options.api_key)
    }
    if (!options.api_key || !options.audience_id) {
      this.logger.warn(
        "[resend-marketing] not configured (need RESEND_API_KEY + RESEND_AUDIENCE_ID) — marketing disabled."
      )
    }
  }

  isConfigured(): boolean {
    return !!this.client && !!this.audienceId
  }

  private ensure(): { client: Resend; audienceId: string } {
    if (!this.client || !this.audienceId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Resend marketing is not configured (RESEND_API_KEY + RESEND_AUDIENCE_ID)."
      )
    }
    return { client: this.client, audienceId: this.audienceId }
  }

  /** Add a buyer to the audience. Create-and-ignore-duplicate so we never resubscribe an opt-out. */
  async upsertContact(input: { email: string; firstName?: string }): Promise<void> {
    const { client, audienceId } = this.ensure()
    const { error } = await client.contacts.create({
      audienceId,
      email: input.email,
      firstName: input.firstName,
      unsubscribed: false,
    })
    if (error && !/already (exists|in)/i.test(`${(error as any).message ?? error}`)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend contact create failed: ${(error as any).message ?? error}`
      )
    }
  }

  async sendTest(input: { to: string; subject: string; html: string }): Promise<string> {
    const { client } = this.ensure()
    const { data, error } = await client.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
    if (error || !data) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend test send failed: ${(error as any)?.message ?? "unknown"}`
      )
    }
    return data.id
  }

  async createAndSendBroadcast(input: {
    subject: string
    html: string
    name?: string
    previewText?: string
  }): Promise<string> {
    const { client, audienceId } = this.ensure()
    const created = await client.broadcasts.create({
      audienceId,
      from: this.from,
      subject: input.subject,
      html: input.html,
      name: input.name,
      previewText: input.previewText,
    })
    if (created.error || !created.data) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend broadcast create failed: ${(created.error as any)?.message ?? "unknown"}`
      )
    }
    const sent = await client.broadcasts.send(created.data.id)
    if (sent.error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend broadcast send failed: ${(sent.error as any).message}`
      )
    }
    return created.data.id
  }
}
