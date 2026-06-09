# Marketing Email Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-admin "Email Studio" (Medusa admin page) to compose, save, and send branded marketing emails to a Resend Audience, with buyers auto-synced on `order.placed` and Resend-managed unsubscribe.

**Architecture:** Backend = two Medusa modules (`marketingEmail` persistence + `resendMarketing` API wrapper), workflows for all mutations, an `order.placed` audience-sync subscriber, and `/admin/marketing-emails` routes. Frontend = a Medusa admin route embedding `@react-email/editor`. Marketing emails are wrapped server-side in a shared brand shell (`wrapMarketingHtml`) carrying the unsubscribe link. Transactional emails are untouched.

**Tech Stack:** Medusa v2.15.5, TypeScript, `resend` SDK 6.5.2, `@react-email/editor`, `@react-email/components`, `@medusajs/ui` + `@medusajs/admin-sdk`, jest + `@swc/jest` (unit).

**Spec:** `docs/superpowers/specs/2026-06-08-marketing-email-studio-design.md`

**Working dir:** all paths under `apps/backend/`. Branch `main` (auto-deploys on push).

**Testing approach:** TDD (jest unit) for pure functions + the `resendMarketing` service (mocked `resend`). Medusa-integration (model/workflows/routes/subscriber) and admin UI are verified with `npx tsc --noEmit`, `npx medusa build`, and live checks against the deployed backend — matching the existing codebase (no integration tests, missing jest setup).

**Resend SDK signatures (verified against installed `resend@6.5.2` types):**
- `client.contacts.create({ audienceId, email, firstName?, unsubscribed? })` → `{ data: { id }, error }`
- `client.broadcasts.create({ audienceId, from, subject, html, name?, previewText? })` → `{ data: { id }, error }`
- `client.broadcasts.send(id)` → `{ data, error }`
- `client.emails.send({ from, to, subject, html })` → `{ data: { id }, error }`

---

## File Structure

**Create:**
- `src/modules/resend/emails/brand-tokens.ts` — shared logo URL + colour hex (DRY for react-email + the marketing wrapper)
- `src/modules/resend/emails/marketing-shell.ts` — `wrapMarketingHtml(body, {preheader})` string template (pure)
- `src/modules/resend/emails/__tests__/marketing-shell.unit.spec.ts`
- `integration-tests/setup.js` — no-op to unblock the jest harness
- `src/modules/marketing-email/models/marketing-email.ts` — data model
- `src/modules/marketing-email/service.ts` — CRUD service
- `src/modules/marketing-email/index.ts` — module export
- `src/modules/marketing-email/migrations/*` — generated
- `src/modules/resend-marketing/service.ts` — Resend Audiences/Contacts/Broadcasts wrapper
- `src/modules/resend-marketing/index.ts` — module export
- `src/modules/resend-marketing/__tests__/service.unit.spec.ts`
- `src/workflows/marketing/steps/marketing-email-crud.ts` — CRUD steps
- `src/workflows/marketing/steps/resend-marketing.ts` — Resend steps
- `src/workflows/marketing/create-marketing-email.ts`, `update-marketing-email.ts`, `delete-marketing-email.ts`
- `src/workflows/marketing/send-marketing-test.ts`, `send-marketing-broadcast.ts`, `sync-contact-to-audience.ts`
- `src/subscribers/order-placed-audience.ts`
- `src/api/admin/marketing-emails/route.ts`, `[id]/route.ts`, `[id]/test/route.ts`, `[id]/send/route.ts`
- `src/api/admin/marketing-emails/validators.ts` — zod schemas + types
- `src/admin/routes/marketing/page.tsx` — list + nav config
- `src/admin/routes/marketing/[id]/page.tsx` — editor
- `src/admin/lib/sdk.ts` — configured admin JS SDK (if not already present)

**Modify:**
- `src/modules/resend/emails/components/brand.tsx` — import tokens from `brand-tokens.ts`
- `medusa-config.ts` — register both new modules
- `docker-compose.yml` — pass `RESEND_AUDIENCE_ID`, `RESEND_MARKETING_FROM`
- `apps/backend/package.json` — add `@react-email/editor`

---

## Task 0: Editor compatibility spike (GATE)

Proves `@react-email/editor` runs inside Medusa admin (React 18.3) before building the real UI. **Pass → continue as written. Fail → Approach-2 fallback** (replace the `<EmailEditor>` in Task 12 with a markdown textarea + `wrapMarketingHtml` live preview; everything else is identical).

**Files:** Create (throwaway): `src/admin/widgets/_editor-spike.tsx`. Modify: `apps/backend/package.json`.

- [ ] **Step 1: Add the editor dependency**

Run: `corepack pnpm@10.11.1 add @react-email/editor --filter @dtc/backend`
Expected: installs; `@react-email/editor` appears in `apps/backend/package.json` dependencies.

- [ ] **Step 2: Add a throwaway admin widget that renders the editor**

Create `src/admin/widgets/_editor-spike.tsx`:

```tsx
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { EmailEditor } from "@react-email/editor"
import "@react-email/editor/themes/default.css"

const EditorSpike = () => {
  return (
    <div style={{ padding: 16 }}>
      <EmailEditor content="<p>Spike: does this render?</p>" theme="basic" />
    </div>
  )
}

export const config = defineWidgetConfig({ zone: "order.list.before" })
export default EditorSpike
```

- [ ] **Step 3: Build the admin to see if it compiles/bundles**

Run: `cd apps/backend && npx medusa build`
Expected: "Backend build completed successfully" AND no errors referencing `@react-email/editor` / React version. If the build errors on the editor (e.g. requires React 19, ESM/CSS issues), the gate **fails**.

- [ ] **Step 4: Load it in the browser (if build passed)**

Start dev or deploy, open `/app` → Orders list, confirm the editor renders and is interactive.

- [ ] **Step 5: Record the decision and remove the spike widget**

Delete `src/admin/widgets/_editor-spike.tsx`. Note the outcome in the commit message. If **failed**, also note: "Task 12 uses the markdown fallback."

- [ ] **Step 6: Commit**

```bash
git add apps/backend/package.json pnpm-lock.yaml
git commit -m "chore(admin): editor compatibility spike — <PASS|FAIL: details>"
```

---

## Task 1: Extract brand tokens (DRY prep)

**Files:** Create `src/modules/resend/emails/brand-tokens.ts`. Modify `src/modules/resend/emails/components/brand.tsx`.

- [ ] **Step 1: Create the shared tokens**

Create `src/modules/resend/emails/brand-tokens.ts`:

```ts
// Shared brand constants used by both the react-email components and the
// string-based marketing wrapper, so they can never drift.
export const LOGO_WHITE_URL =
  "https://compose-reboot-optical-transmitter-kvvhi-8299f2-69-62-122-190.sslip.io/static/1780949763297-strydr-wordmark-white.png"

export const COLORS = {
  ink: "#222222", // headlines / dark bands (StrydrBlack)
  body: "#3e4a3b", // body text
  muted: "#6e7b69", // muted labels
  green: "#4cc04b", // StrydrGreen — CTA / accent
  onGreen: "#00490a", // text on green
  leaf: "#006e14", // deep green — eyebrows
  surface: "#f9f9f9", // page background
  panel: "#f3f3f4", // soft-grey panels
} as const
```

- [ ] **Step 2: Use the token in `brand.tsx`**

In `src/modules/resend/emails/components/brand.tsx`, remove the local `const LOGO_WHITE_URL = "..."` declaration and add at the top (after the existing imports):

```ts
import { LOGO_WHITE_URL } from "../brand-tokens"
```

(Leave the Tailwind colour config as-is; the tokens file is the single source for the marketing wrapper and the logo URL.)

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/modules/resend/emails/brand-tokens.ts src/modules/resend/emails/components/brand.tsx
git commit -m "refactor(email): extract shared brand tokens (logo url + colours)"
```

---

## Task 2: `wrapMarketingHtml` brand wrapper (TDD)

Wraps editor body HTML in the dark header/footer brand shell with the unsubscribe link. Also unblocks the jest unit harness.

**Files:** Create `integration-tests/setup.js`, `src/modules/resend/emails/marketing-shell.ts`, `src/modules/resend/emails/__tests__/marketing-shell.unit.spec.ts`.

- [ ] **Step 1: Unblock the jest unit harness**

Create `integration-tests/setup.js`:

```js
// No-op setup so jest (configured with setupFiles) can run unit tests.
```

- [ ] **Step 2: Write the failing unit test**

Create `src/modules/resend/emails/__tests__/marketing-shell.unit.spec.ts`:

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/backend && npm run test:unit -- marketing-shell`
Expected: FAIL — cannot find module `../marketing-shell`.

- [ ] **Step 4: Implement `marketing-shell.ts`**

Create `src/modules/resend/emails/marketing-shell.ts`:

```ts
import { LOGO_WHITE_URL, COLORS } from "./brand-tokens"

/**
 * Wrap already-rendered body HTML (from the editor) in the Strydr marketing
 * brand shell: dark header band with the wordmark, white rounded body, dark
 * footer band with the Resend unsubscribe link. A string template (not a
 * react-email render) because the body is HTML, not JSX.
 */
export function wrapMarketingHtml(
  bodyHtml: string,
  opts: { preheader?: string } = {}
): string {
  const year = new Date().getFullYear()
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
    : ""
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:${COLORS.surface};font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};padding:40px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;">
<tr><td style="background:${COLORS.ink};padding:24px 32px;">
<img src="${LOGO_WHITE_URL}" alt="Strydr" height="26" style="height:26px;width:auto;display:block;border:0;"/>
</td></tr>
<tr><td style="padding:32px;color:${COLORS.body};font-size:15px;line-height:1.6;">
${bodyHtml}
</td></tr>
<tr><td style="background:${COLORS.ink};padding:28px 32px;text-align:center;">
<p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;line-height:1.5;">You're receiving this because you bought from Strydr. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${COLORS.green};text-decoration:underline;">Unsubscribe</a>.</p>
<p style="margin:12px 0 0;color:rgba(255,255,255,0.4);font-size:11px;">© ${year} Strydr · Redefining mobility</p>
</td></tr>
</table></td></tr></table></body></html>`
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/backend && npm run test:unit -- marketing-shell`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add integration-tests/setup.js src/modules/resend/emails/marketing-shell.ts src/modules/resend/emails/__tests__/marketing-shell.unit.spec.ts
git commit -m "feat(email): wrapMarketingHtml brand shell with unsubscribe (TDD)"
```

---

## Task 3: `marketingEmail` persistence module

**Files:** Create `src/modules/marketing-email/models/marketing-email.ts`, `service.ts`, `index.ts`. Modify `medusa-config.ts`.

- [ ] **Step 1: Data model**

Create `src/modules/marketing-email/models/marketing-email.ts`:

```ts
import { model } from "@medusajs/framework/utils"

const MarketingEmail = model.define("marketing_email", {
  id: model.id().primaryKey(),
  name: model.text(),
  subject: model.text(),
  preheader: model.text().nullable(),
  editor_json: model.json().nullable(),
  body_html: model.text().nullable(),
  status: model.enum(["draft", "sending", "sent"]).default("draft"),
  resend_broadcast_id: model.text().nullable(),
  sent_at: model.dateTime().nullable(),
})

export default MarketingEmail
```

- [ ] **Step 2: Service**

Create `src/modules/marketing-email/service.ts`:

```ts
import { MedusaService } from "@medusajs/framework/utils"
import MarketingEmail from "./models/marketing-email"

class MarketingEmailService extends MedusaService({ MarketingEmail }) {}

export default MarketingEmailService
```

- [ ] **Step 3: Module export**

Create `src/modules/marketing-email/index.ts`:

```ts
import { Module } from "@medusajs/framework/utils"
import MarketingEmailService from "./service"

export const MARKETING_EMAIL_MODULE = "marketingEmail"

export default Module(MARKETING_EMAIL_MODULE, {
  service: MarketingEmailService,
})
```

- [ ] **Step 4: Register in `medusa-config.ts`**

In the `modules` array (after the `royalmail` module), add:

```ts
{ resolve: "./src/modules/marketing-email" },
```

- [ ] **Step 5: Generate the migration (offline — no DB needed)**

Run: `cd apps/backend && npx medusa db:generate marketingEmail`
Expected: creates `src/modules/marketing-email/migrations/Migration*.ts`. (Migration is applied automatically on deploy by `start.sh`’s `db:migrate`.)

- [ ] **Step 6: Verify build**

Run: `cd apps/backend && npx medusa build`
Expected: "Backend build completed successfully".

- [ ] **Step 7: Commit**

```bash
git add src/modules/marketing-email medusa-config.ts
git commit -m "feat(marketing): marketingEmail module (model + service + migration)"
```

---

## Task 4: `resendMarketing` module service (TDD)

**Files:** Create `src/modules/resend-marketing/service.ts`, `__tests__/service.unit.spec.ts`.

- [ ] **Step 1: Write the failing unit test (mocked Resend SDK)**

Create `src/modules/resend-marketing/__tests__/service.unit.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/backend && npm run test:unit -- resend-marketing`
Expected: FAIL — cannot find `../service`.

- [ ] **Step 3: Implement the service**

Create `src/modules/resend-marketing/service.ts`:

```ts
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
    if (error && !/already (exists|in)/i.test(`${error.message ?? error}`)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend contact create failed: ${error.message ?? error}`
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
        `Resend test send failed: ${error?.message ?? "unknown"}`
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
        `Resend broadcast create failed: ${created.error?.message ?? "unknown"}`
      )
    }
    const sent = await client.broadcasts.send(created.data.id)
    if (sent.error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend broadcast send failed: ${sent.error.message}`
      )
    }
    return created.data.id
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/backend && npm run test:unit -- resend-marketing`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/resend-marketing/service.ts src/modules/resend-marketing/__tests__
git commit -m "feat(marketing): resendMarketing service — contacts + broadcasts (TDD)"
```

---

## Task 5: Register `resendMarketing` module + env wiring

**Files:** Create `src/modules/resend-marketing/index.ts`. Modify `medusa-config.ts`, `docker-compose.yml`.

- [ ] **Step 1: Module export**

Create `src/modules/resend-marketing/index.ts`:

```ts
import { Module } from "@medusajs/framework/utils"
import ResendMarketingService from "./service"

export const RESEND_MARKETING_MODULE = "resendMarketing"

export default Module(RESEND_MARKETING_MODULE, {
  service: ResendMarketingService,
})
```

- [ ] **Step 2: Register with options in `medusa-config.ts`**

In the `modules` array, after the `marketing-email` module, add:

```ts
{
  resolve: "./src/modules/resend-marketing",
  options: {
    api_key: process.env.RESEND_API_KEY,
    audience_id: process.env.RESEND_AUDIENCE_ID,
    from: process.env.RESEND_MARKETING_FROM || "Strydr <hello@strydr.co.uk>",
  },
},
```

- [ ] **Step 3: Pass env through `docker-compose.yml`**

In the `medusa` service `environment:` block, after `ROYALMAIL_API_KEY`, add:

```yaml
      RESEND_AUDIENCE_ID: "${RESEND_AUDIENCE_ID}"
      RESEND_MARKETING_FROM: "${RESEND_MARKETING_FROM}"
```

- [ ] **Step 4: Verify build**

Run: `cd apps/backend && npx medusa build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/modules/resend-marketing/index.ts medusa-config.ts docker-compose.yml
git commit -m "feat(marketing): register resendMarketing module + env passthrough"
```

---

## Task 6: Workflow steps

**Files:** Create `src/workflows/marketing/steps/marketing-email-crud.ts`, `src/workflows/marketing/steps/resend-marketing.ts`.

- [ ] **Step 1: CRUD steps**

Create `src/workflows/marketing/steps/marketing-email-crud.ts`:

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MARKETING_EMAIL_MODULE } from "../../../modules/marketing-email"
import MarketingEmailService from "../../../modules/marketing-email/service"

type CreateInput = { name: string; subject: string; preheader?: string }

export const createMarketingEmailStep = createStep(
  "create-marketing-email",
  async (input: CreateInput, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    const created = await svc.createMarketingEmails(input)
    return new StepResponse(created, created.id)
  },
  async (id, { container }) => {
    if (!id) return
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.deleteMarketingEmails(id)
  }
)

type UpdateInput = {
  id: string
  name?: string
  subject?: string
  preheader?: string | null
  editor_json?: unknown
  body_html?: string
  status?: "draft" | "sending" | "sent"
  resend_broadcast_id?: string
  sent_at?: Date
}

export const updateMarketingEmailStep = createStep(
  "update-marketing-email",
  async (input: UpdateInput, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    const before = await svc.retrieveMarketingEmail(input.id)
    const updated = await svc.updateMarketingEmails(input)
    return new StepResponse(updated, before)
  },
  async (before, { container }) => {
    if (!before) return
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.updateMarketingEmails({
      id: before.id,
      status: before.status,
      resend_broadcast_id: before.resend_broadcast_id,
      sent_at: before.sent_at,
    })
  }
)

export const deleteMarketingEmailStep = createStep(
  "delete-marketing-email",
  async (id: string, { container }) => {
    const svc = container.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
    await svc.deleteMarketingEmails(id)
    return new StepResponse({ id })
  }
)
```

- [ ] **Step 2: Resend steps**

Create `src/workflows/marketing/steps/resend-marketing.ts`:

```ts
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { RESEND_MARKETING_MODULE } from "../../../modules/resend-marketing"
import ResendMarketingService from "../../../modules/resend-marketing/service"
import { wrapMarketingHtml } from "../../../modules/resend/emails/marketing-shell"

export const upsertContactStep = createStep(
  "upsert-marketing-contact",
  async (input: { email: string; firstName?: string }, { container }) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    await svc.upsertContact(input)
    return new StepResponse({ ok: true })
  }
)

export const sendMarketingTestStep = createStep(
  "send-marketing-test",
  async (
    input: { to: string; subject: string; body_html: string; preheader?: string },
    { container }
  ) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    const html = wrapMarketingHtml(input.body_html, { preheader: input.preheader })
    const id = await svc.sendTest({ to: input.to, subject: input.subject, html })
    return new StepResponse({ id })
  }
)

export const sendMarketingBroadcastStep = createStep(
  "send-marketing-broadcast",
  async (
    input: { name: string; subject: string; body_html: string; preheader?: string },
    { container }
  ) => {
    const svc = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
    const html = wrapMarketingHtml(input.body_html, { preheader: input.preheader })
    const broadcastId = await svc.createAndSendBroadcast({
      name: input.name,
      subject: input.subject,
      previewText: input.preheader,
      html,
    })
    return new StepResponse({ broadcastId })
  }
)
```

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/workflows/marketing/steps
git commit -m "feat(marketing): workflow steps (CRUD + resend contact/test/broadcast)"
```

---

## Task 7: Workflows

**Files:** Create the six workflow files in `src/workflows/marketing/`.

- [ ] **Step 1: CRUD workflows**

Create `src/workflows/marketing/create-marketing-email.ts`:

```ts
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createMarketingEmailStep } from "./steps/marketing-email-crud"

type Input = { name: string; subject: string; preheader?: string }

export const createMarketingEmailWorkflow = createWorkflow(
  "create-marketing-email-wf",
  (input: Input) => {
    const email = createMarketingEmailStep(input)
    return new WorkflowResponse({ email })
  }
)
```

Create `src/workflows/marketing/update-marketing-email.ts`:

```ts
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateMarketingEmailStep } from "./steps/marketing-email-crud"

type Input = {
  id: string
  name?: string
  subject?: string
  preheader?: string | null
  editor_json?: unknown
  body_html?: string
}

export const updateMarketingEmailWorkflow = createWorkflow(
  "update-marketing-email-wf",
  (input: Input) => {
    const email = updateMarketingEmailStep(input)
    return new WorkflowResponse({ email })
  }
)
```

Create `src/workflows/marketing/delete-marketing-email.ts`:

```ts
import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteMarketingEmailStep } from "./steps/marketing-email-crud"

export const deleteMarketingEmailWorkflow = createWorkflow(
  "delete-marketing-email-wf",
  (input: { id: string }) => {
    const result = deleteMarketingEmailStep(input.id)
    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step 2: Test-send workflow**

Create `src/workflows/marketing/send-marketing-test.ts`:

```ts
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendMarketingTestStep } from "./steps/resend-marketing"

type Input = { id: string; to: string }

export const sendMarketingTestWorkflow = createWorkflow(
  "send-marketing-test-wf",
  ({ id, to }: Input) => {
    const { data: rows } = useQueryGraphStep({
      entity: "marketing_email",
      fields: ["id", "subject", "preheader", "body_html"],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })
    const payload = transform({ rows, to }, (d) => ({
      to: d.to,
      subject: d.rows[0].subject,
      body_html: d.rows[0].body_html ?? "",
      preheader: d.rows[0].preheader ?? undefined,
    }))
    const result = sendMarketingTestStep(payload)
    return new WorkflowResponse(result)
  }
)
```

- [ ] **Step 3: Broadcast workflow (status transitions + compensation)**

Create `src/workflows/marketing/send-marketing-broadcast.ts`:

```ts
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { sendMarketingBroadcastStep } from "./steps/resend-marketing"
import { updateMarketingEmailStep } from "./steps/marketing-email-crud"

export const sendMarketingBroadcastWorkflow = createWorkflow(
  "send-marketing-broadcast-wf",
  ({ id }: { id: string }) => {
    const { data: rows } = useQueryGraphStep({
      entity: "marketing_email",
      fields: ["id", "name", "subject", "preheader", "body_html"],
      filters: { id },
      options: { throwIfKeyNotFound: true },
    })

    // Mark sending (compensation reverts to draft on failure).
    updateMarketingEmailStep({ id, status: "sending" }).config({ name: "mark-sending" })

    const payload = transform({ rows }, (d) => ({
      name: d.rows[0].name,
      subject: d.rows[0].subject,
      body_html: d.rows[0].body_html ?? "",
      preheader: d.rows[0].preheader ?? undefined,
    }))

    const sent = sendMarketingBroadcastStep(payload)

    const final = transform({ id, sent }, (d) => ({
      id: d.id,
      status: "sent" as const,
      resend_broadcast_id: d.sent.broadcastId,
      sent_at: new Date(),
    }))
    updateMarketingEmailStep(final).config({ name: "mark-sent" })

    return new WorkflowResponse(sent)
  }
)
```

- [ ] **Step 4: Audience-sync workflow**

Create `src/workflows/marketing/sync-contact-to-audience.ts`:

```ts
import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { upsertContactStep } from "./steps/resend-marketing"

export const syncContactToAudienceWorkflow = createWorkflow(
  "sync-contact-to-audience-wf",
  ({ order_id }: { order_id: string }) => {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: ["id", "email", "shipping_address.first_name"],
      filters: { id: order_id },
      options: { throwIfKeyNotFound: true },
    })

    const result = when({ orders }, (d) => !!d.orders[0]?.email).then(() => {
      const input = transform({ orders }, (d) => ({
        email: d.orders[0].email as string,
        firstName: d.orders[0].shipping_address?.first_name ?? undefined,
      }))
      return upsertContactStep(input)
    })

    return new WorkflowResponse({ result })
  }
)
```

- [ ] **Step 5: Verify build**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (If `marketing_email` is not yet a queryable entity for `useQueryGraphStep`, run `npx medusa build` first to regenerate types, then re-run tsc.)

- [ ] **Step 6: Commit**

```bash
git add src/workflows/marketing
git commit -m "feat(marketing): CRUD + test + broadcast + audience-sync workflows"
```

---

## Task 8: `order.placed` audience-sync subscriber

**Files:** Create `src/subscribers/order-placed-audience.ts`.

- [ ] **Step 1: Implement the subscriber**

Create `src/subscribers/order-placed-audience.ts`:

```ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { RESEND_MARKETING_MODULE } from "../modules/resend-marketing"
import ResendMarketingService from "../modules/resend-marketing/service"
import { syncContactToAudienceWorkflow } from "../workflows/marketing/sync-contact-to-audience"

// Adds the buyer to the Resend marketing audience on order placement.
// Error-isolated; no-op when marketing isn't configured.
export default async function orderPlacedAudienceHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const marketing = container.resolve<ResendMarketingService>(RESEND_MARKETING_MODULE)
  if (!marketing.isConfigured()) {
    return
  }
  try {
    await syncContactToAudienceWorkflow(container).run({ input: { order_id: data.id } })
    logger.info(`[resend-marketing] synced order ${data.id} buyer to audience`)
  } catch (e) {
    logger.error(
      `[resend-marketing] audience sync failed for order ${data.id}: ${
        e instanceof Error ? e.message : e
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/backend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/subscribers/order-placed-audience.ts
git commit -m "feat(marketing): order.placed audience-sync subscriber"
```

---

## Task 9: Admin API routes

**Files:** Create `src/api/admin/marketing-emails/validators.ts`, `route.ts`, `[id]/route.ts`, `[id]/test/route.ts`, `[id]/send/route.ts`.

- [ ] **Step 1: Validators**

Create `src/api/admin/marketing-emails/validators.ts`:

```ts
import { z } from "zod"

export const CreateMarketingEmailSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  preheader: z.string().optional(),
})
export type CreateMarketingEmailBody = z.infer<typeof CreateMarketingEmailSchema>

export const UpdateMarketingEmailSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  preheader: z.string().nullable().optional(),
  editor_json: z.any().optional(),
  body_html: z.string().optional(),
})
export type UpdateMarketingEmailBody = z.infer<typeof UpdateMarketingEmailSchema>

export const TestSendSchema = z.object({ to: z.string().email() })
export type TestSendBody = z.infer<typeof TestSendSchema>
```

- [ ] **Step 2: List + create route**

Create `src/api/admin/marketing-emails/route.ts`:

```ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_EMAIL_MODULE } from "../../../modules/marketing-email"
import MarketingEmailService from "../../../modules/marketing-email/service"
import { createMarketingEmailWorkflow } from "../../../workflows/marketing/create-marketing-email"
import { CreateMarketingEmailSchema } from "./validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
  const [emails, count] = await svc.listAndCountMarketingEmails(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  )
  res.json({ marketing_emails: emails, count })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = CreateMarketingEmailSchema.parse(req.body)
  const { result } = await createMarketingEmailWorkflow(req.scope).run({ input: body })
  res.status(201).json({ marketing_email: result.email })
}
```

- [ ] **Step 3: Retrieve + update + delete route**

Create `src/api/admin/marketing-emails/[id]/route.ts`:

```ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_EMAIL_MODULE } from "../../../../modules/marketing-email"
import MarketingEmailService from "../../../../modules/marketing-email/service"
import { updateMarketingEmailWorkflow } from "../../../../workflows/marketing/update-marketing-email"
import { deleteMarketingEmailWorkflow } from "../../../../workflows/marketing/delete-marketing-email"
import { UpdateMarketingEmailSchema } from "../validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve<MarketingEmailService>(MARKETING_EMAIL_MODULE)
  const email = await svc.retrieveMarketingEmail(req.params.id)
  res.json({ marketing_email: email })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const body = UpdateMarketingEmailSchema.parse(req.body)
  const { result } = await updateMarketingEmailWorkflow(req.scope).run({
    input: { id: req.params.id, ...body },
  })
  res.json({ marketing_email: result.email })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteMarketingEmailWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "marketing_email", deleted: true })
}
```

- [ ] **Step 4: Test-send route**

Create `src/api/admin/marketing-emails/[id]/test/route.ts`:

```ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendMarketingTestWorkflow } from "../../../../../workflows/marketing/send-marketing-test"
import { TestSendSchema } from "../../validators"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { to } = TestSendSchema.parse(req.body)
  const { result } = await sendMarketingTestWorkflow(req.scope).run({
    input: { id: req.params.id, to },
  })
  res.json({ sent: true, id: result.id })
}
```

- [ ] **Step 5: Send-broadcast route**

Create `src/api/admin/marketing-emails/[id]/send/route.ts`:

```ts
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendMarketingBroadcastWorkflow } from "../../../../../workflows/marketing/send-marketing-broadcast"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await sendMarketingBroadcastWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.json({ sent: true, broadcast_id: result.broadcastId })
}
```

- [ ] **Step 6: Verify build**

Run: `cd apps/backend && npx medusa build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/api/admin/marketing-emails
git commit -m "feat(marketing): admin API routes (CRUD + test + send)"
```

---

## Task 10: Admin UI — list page + navigation

**Files:** Create `src/admin/lib/sdk.ts` (if absent), `src/admin/routes/marketing/page.tsx`.

> **Before coding the UI:** load the `medusa-dev:building-admin-dashboard-customizations` skill for the current admin data-loading + `defineRouteConfig` conventions, and confirm the `@medusajs/js-sdk` import path. The code below is the standard 2.15 pattern.

- [ ] **Step 1: Admin SDK helper (skip if `src/admin/lib/sdk.ts` already exists)**

Create `src/admin/lib/sdk.ts`:

```ts
import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: typeof window !== "undefined" ? window.location.origin : "/",
  auth: { type: "session" },
})
```

- [ ] **Step 2: List page + sidebar item**

Create `src/admin/routes/marketing/page.tsx`:

```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Megaphone } from "@medusajs/icons"
import { Container, Heading, Button, Table, Badge, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../lib/sdk"

type MarketingEmail = {
  id: string
  name: string
  subject: string
  status: "draft" | "sending" | "sent"
  sent_at: string | null
}

const MarketingPage = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<MarketingEmail[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    sdk.client
      .fetch<{ marketing_emails: MarketingEmail[] }>("/admin/marketing-emails")
      .then((r) => setRows(r.marketing_emails))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const createDraft = async () => {
    const r = await sdk.client.fetch<{ marketing_email: MarketingEmail }>(
      "/admin/marketing-emails",
      { method: "POST", body: { name: "Untitled", subject: "Untitled" } }
    )
    navigate(`/marketing/${r.marketing_email.id}`)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Marketing</Heading>
        <Button size="small" variant="primary" onClick={createDraft}>
          New email
        </Button>
      </div>
      {loading ? (
        <Text className="px-6 py-4">Loading…</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Subject</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row
                key={r.id}
                className="cursor-pointer"
                onClick={() => navigate(`/marketing/${r.id}`)}
              >
                <Table.Cell>{r.name}</Table.Cell>
                <Table.Cell>{r.subject}</Table.Cell>
                <Table.Cell>
                  <Badge color={r.status === "sent" ? "green" : "grey"}>{r.status}</Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Marketing", icon: Megaphone })

export default MarketingPage
```

- [ ] **Step 3: Build the admin + load in browser**

Run: `cd apps/backend && npx medusa build`
Then load `/app` → confirm a "Marketing" sidebar item, the list renders, and "New email" creates a draft and navigates to `/marketing/:id` (the editor route, built next).

- [ ] **Step 4: Commit**

```bash
git add src/admin/lib/sdk.ts src/admin/routes/marketing/page.tsx
git commit -m "feat(admin): Marketing list page + sidebar nav"
```

---

## Task 11: Admin UI — editor page

**Files:** Create `src/admin/routes/marketing/[id]/page.tsx`.

> **Editor API check (do first):** open `node_modules/@react-email/editor` types (and the package's `references/EDITOR.md`) and confirm: how `<EmailEditor>` exposes content (via `ref` — e.g. `ref.current.getJSON()` / an `onChange`) and the exact `composeReactEmail` signature (sync vs async; input = editor JSON/content, output = `{ html, text }`). Wire Save accordingly. If Task 0 **failed**, skip the editor and use the fallback in Step 2b.

- [ ] **Step 1: Editor page (Approach 1 — visual editor)**

Create `src/admin/routes/marketing/[id]/page.tsx`:

```tsx
import { EmailEditor, type EmailEditorRef, composeReactEmail } from "@react-email/editor"
import "@react-email/editor/themes/default.css"
import { Container, Heading, Button, Input, Label, toast, Prompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { sdk } from "../../../lib/sdk"

type MarketingEmail = {
  id: string
  name: string
  subject: string
  preheader: string | null
  editor_json: unknown
  status: string
}

const EditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const ref = useRef<EmailEditorRef>(null)
  const [email, setEmail] = useState<MarketingEmail | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")

  useEffect(() => {
    sdk.client
      .fetch<{ marketing_email: MarketingEmail }>(`/admin/marketing-emails/${id}`)
      .then((r) => {
        setEmail(r.marketing_email)
        setName(r.marketing_email.name)
        setSubject(r.marketing_email.subject)
        setPreheader(r.marketing_email.preheader ?? "")
      })
  }, [id])

  // Compose body HTML from the editor's current content (confirm API at Step 0).
  const compose = async (): Promise<{ editor_json: unknown; body_html: string }> => {
    const content = ref.current?.getJSON()
    const { html } = await composeReactEmail(content)
    return { editor_json: content, body_html: html }
  }

  const save = async () => {
    const { editor_json, body_html } = await compose()
    await sdk.client.fetch(`/admin/marketing-emails/${id}`, {
      method: "POST",
      body: { name, subject, preheader: preheader || null, editor_json, body_html },
    })
    toast.success("Saved")
  }

  const sendTest = async () => {
    await save()
    const to = window.prompt("Send a test to which email?")
    if (!to) return
    await sdk.client.fetch(`/admin/marketing-emails/${id}/test`, {
      method: "POST",
      body: { to },
    })
    toast.success(`Test sent to ${to}`)
  }

  const sendBroadcast = async () => {
    await save()
    await sdk.client.fetch(`/admin/marketing-emails/${id}/send`, { method: "POST" })
    toast.success("Broadcast sent to your audience")
    navigate("/marketing")
  }

  if (!email) return null

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Edit email</Heading>
        <div className="flex gap-2">
          <Button size="small" variant="secondary" onClick={save}>Save</Button>
          <Button size="small" variant="secondary" onClick={sendTest}>Send test</Button>
          <Prompt>
            <Prompt.Trigger asChild>
              <Button size="small" variant="primary">Send to audience</Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Send broadcast?</Prompt.Title>
                <Prompt.Description>
                  This emails your entire marketing audience. This cannot be undone.
                </Prompt.Description>
              </Prompt.Header>
              <Prompt.Footer>
                <Prompt.Cancel>Cancel</Prompt.Cancel>
                <Prompt.Action onClick={sendBroadcast}>Send</Prompt.Action>
              </Prompt.Footer>
            </Prompt.Content>
          </Prompt>
        </div>
      </div>

      <div className="grid gap-3 px-6 pb-4">
        <div>
          <Label>Internal name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Preheader (inbox preview text)</Label>
          <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} />
        </div>
      </div>

      <div className="px-6 pb-6">
        <EmailEditor ref={ref} content={(email.editor_json as string) ?? "<p></p>"} theme="basic" />
      </div>
    </Container>
  )
}

export default EditorPage
```

- [ ] **Step 2a: Build + browser verify (Approach 1)**

Run: `cd apps/backend && npx medusa build`
Load `/app` → `/marketing` → open a draft → type content → **Save** → reload → content persists. (Test/Send verified live in Task 12 once env is set.)

- [ ] **Step 2b: FALLBACK (only if Task 0 failed) — markdown composer**

Replace the editor block: drop `@react-email/editor` imports; add `import { marked } from "marked"` (`corepack pnpm@10.11.1 add marked --filter @dtc/backend`); store a markdown string in `editor_json` (`{ markdown }`); `compose()` returns `{ editor_json: { markdown }, body_html: marked.parse(markdown) }`; render a `<Textarea>` for markdown + a live `<iframe srcDoc={wrappedPreview}>`. Everything else (save/test/send) is unchanged. (Note: `wrapMarketingHtml` is server-side; for the client preview, show the raw `marked` output.)

- [ ] **Step 3: Commit**

```bash
git add src/admin/routes/marketing/[id]/page.tsx
git commit -m "feat(admin): marketing email editor page (compose/save/test/send)"
```

---

## Task 12: End-to-end verification + deploy

**Files:** none (ops + verification).

- [ ] **Step 1: Create the Resend Audience + verify sender**

In the Resend dashboard: create an Audience (e.g. "Strydr Customers"), copy its id. Verify the `hello@strydr.co.uk` sender/domain under Domains.

- [ ] **Step 2: Set env in Dokploy (user action)**

Add to the `strydr-medusa` env (same place as the other keys):

```
RESEND_AUDIENCE_ID=<audience id from step 1>
RESEND_MARKETING_FROM=Strydr <hello@strydr.co.uk>
```

- [ ] **Step 3: Push (auto-deploy runs migrations on start)**

```bash
git push origin main
```

Then confirm the redeploy is healthy (poll `…sslip.io/health` → 200) and the logs show no module/migration errors; `marketing_email` migration applied.

- [ ] **Step 4: Live functional checks**

- `/app` → Marketing → New email → compose → Save → reload (persists).
- Send test to your inbox → confirm brand shell + unsubscribe link render.
- Temporarily point `RESEND_AUDIENCE_ID` at a **test audience with one contact (your address)**, send broadcast → confirm receipt + one-click unsubscribe; then switch back.
- Place a test order (gated e2e) → confirm the buyer appears in the Resend Audience and logs show `[resend-marketing] synced order … to audience`.

- [ ] **Step 5: Final commit (if any docs/notes changed)**

```bash
git add -A
git commit -m "docs(marketing): verification notes" || true
git push origin main
```

---

## Self-Review

- **Spec coverage:** persistence (T3) · resend wrapper (T4–5) · audience sync (T7 sync wf + T8 subscriber) · admin routes (T9) · admin UI compose/save/send (T10–11) · brand wrap + unsubscribe (T2) · compat spike + fallback (T0, T11 Step 2b) · env/config (T5, T12) · from `hello@` (T4 default + T5 option) · merge-tag personalization (editor content can include `{{{contact.first_name|there}}}` — the broadcast passes html through verbatim; no extra task needed). All covered.
- **No-resubscribe rule:** enforced in `upsertContact` (create-and-ignore-duplicate) and unit-tested (T4).
- **Type consistency:** module names `marketingEmail` / `resendMarketing`; service methods `createMarketingEmails`/`updateMarketingEmails`/`retrieveMarketingEmail`/`listAndCountMarketingEmails` (Medusa auto-generated plural CRUD); `createAndSendBroadcast`/`upsertContact`/`sendTest` used consistently across service, steps, and tests; `body_html` field name consistent model→workflow→wrapper.
- **Placeholder scan:** none — every step has runnable code/commands. The two "check the API first" steps (editor `composeReactEmail`, admin SDK conventions) include working code + the exact files/skill to confirm against; they de-risk external deps, not defer work.
