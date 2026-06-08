import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components"
import * as React from "react"
import type { BigNumberValue } from "@medusajs/framework/types"

// Kinetic Canvas design tokens (design-reference/DESIGN.md) expressed as Tailwind
// theme extensions so the email templates read like the rest of the brand system.
export const tailwindConfig = {
  theme: {
    extend: {
      colors: {
        ink: "#222222", // headlines (StrydrBlack)
        body: "#3e4a3b", // body text (on-surface-variant)
        muted: "#6e7b69", // muted labels (outline)
        green: "#4cc04b", // StrydrGreen — CTA fill, accents
        onGreen: "#00490a", // text on green
        leaf: "#006e14", // deep green — eyebrows, links
        surface: "#f9f9f9", // page background
        panel: "#f3f3f4", // soft-grey panels (no-line rule)
      },
      fontFamily: {
        heading: ["Montserrat", "Helvetica", "Arial", "sans-serif"],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
}

// White wordmark (rendered from public/logo.svg), hosted on the Medusa file store.
const LOGO_WHITE_URL =
  "https://compose-reboot-optical-transmitter-kvvhi-8299f2-69-62-122-190.sslip.io/static/1780949763297-strydr-wordmark-white.png"

// GBP-style currency formatting, tolerant of Medusa BigNumberValue inputs.
export function formatPrice(price: BigNumberValue, currencyCode = "gbp"): string {
  const value =
    typeof price === "number"
      ? price
      : typeof price === "string"
      ? parseFloat(price)
      : parseFloat(`${price ?? 0}`)
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: currencyCode || "gbp",
  }).format(Number.isNaN(value) ? 0 : value)
}

// Eyebrow label — uppercase, wide tracking, deep green (DESIGN.md component spec).
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text className="m-0 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf">
      {children}
    </Text>
  )
}

// Shared shell: rounded white card on the surface background, with a StrydrBlack
// header band (white wordmark) and a matching footer band.
export function EmailLayout({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html>
      <Head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap"
        />
      </Head>
      <Tailwind config={tailwindConfig}>
        <Preview>{preview}</Preview>
        <Body className="m-0 bg-surface py-10 font-sans">
          <Container className="mx-auto w-full max-w-[600px] overflow-hidden rounded-[24px] bg-white">
            {/* Header band */}
            <Section className="bg-ink px-8 py-6">
              <Img
                src={LOGO_WHITE_URL}
                alt="Strydr"
                height="26"
                className="h-[26px] w-auto"
              />
            </Section>

            {children}

            {/* Footer band */}
            <Section className="bg-ink px-8 py-7">
              <Text className="m-0 text-center font-sans text-[13px] text-white/70">
                Questions about your order? Just reply to this email.
              </Text>
              <Text className="m-0 mt-3 text-center font-sans text-[11px] text-white/40">
                © {new Date().getFullYear()} Strydr · Redefining mobility
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
