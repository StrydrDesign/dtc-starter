const create = jest.fn()
const send = jest.fn()
const emailSend = jest.fn()

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    contacts: { create },
    broadcasts: { create, send },
    emails: { send: emailSend },
  })),
}))

import ResendMarketingService from "../service"

const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() } as any
const opts = { api_key: "re_test", audience_id: "aud_1", from: "Strydr <hello@strydr.co.uk>" }

beforeEach(() => {
  create.mockReset()
  send.mockReset()
  emailSend.mockReset()
})

describe("ResendMarketingService", () => {
  it("upsertContact creates a subscribed contact in the audience", async () => {
    create.mockResolvedValue({ data: { id: "c1" }, error: null })
    const svc = new ResendMarketingService({ logger }, opts)
    await svc.upsertContact({ email: "a@b.com", firstName: "Al" })
    expect(create).toHaveBeenCalledWith({
      audienceId: "aud_1",
      email: "a@b.com",
      firstName: "Al",
      unsubscribed: false,
    })
  })

  it("upsertContact swallows 'already exists' (never resubscribes)", async () => {
    create.mockResolvedValue({ data: null, error: { message: "Contact already exists" } })
    const svc = new ResendMarketingService({ logger }, opts)
    await expect(svc.upsertContact({ email: "a@b.com" })).resolves.toBeUndefined()
  })

  it("createAndSendBroadcast creates then sends, returns id", async () => {
    create.mockResolvedValue({ data: { id: "bc1" }, error: null })
    send.mockResolvedValue({ data: { id: "bc1" }, error: null })
    const svc = new ResendMarketingService({ logger }, opts)
    const id = await svc.createAndSendBroadcast({ subject: "Hi", html: "<p>x</p>" })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ audienceId: "aud_1", from: opts.from, subject: "Hi", html: "<p>x</p>" })
    )
    expect(send).toHaveBeenCalledWith("bc1")
    expect(id).toBe("bc1")
  })

  it("isConfigured is false without audience id", () => {
    const svc = new ResendMarketingService({ logger }, { api_key: "re_test" })
    expect(svc.isConfigured()).toBe(false)
  })
})
