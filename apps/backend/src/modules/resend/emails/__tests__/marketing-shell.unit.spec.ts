import { wrapMarketingHtml } from "../marketing-shell"
import { LOGO_WHITE_URL } from "../brand-tokens"

describe("wrapMarketingHtml", () => {
  it("injects the body, logo, and unsubscribe token", () => {
    const html = wrapMarketingHtml("<h1>Hello</h1>", { preheader: "Peek" })
    expect(html).toContain("<h1>Hello</h1>")
    expect(html).toContain(LOGO_WHITE_URL)
    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}")
    expect(html).toContain("Peek") // preheader
    expect(html).toMatch(/^<!DOCTYPE html>/)
  })

  it("omits preheader markup when not provided", () => {
    const html = wrapMarketingHtml("<p>x</p>")
    expect(html).toContain("<p>x</p>")
    expect(html).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}")
  })
})
