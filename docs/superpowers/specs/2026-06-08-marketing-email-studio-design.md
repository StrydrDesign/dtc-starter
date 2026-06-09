# Marketing Email Studio — Design Spec

**Date:** 2026-06-08 · **Repo:** `dtc-starter` (Medusa backend, branch `main`) · **Status:** Approved design

## Summary

An in-admin "Email Studio" that lets ops **compose, save, and send** branded
**marketing** emails to customers, without touching code. Buyers are auto-synced
to a Resend Audience on order placement; broadcasts are sent via Resend with
automatic per-contact unsubscribe. Transactional emails (order-placed /
order-shipped) stay as code templates and are out of scope here.

## Goals

- Ops can visually compose a branded marketing email in the Medusa admin.
- Save drafts (re-editable) and a library of past/sent emails.
- Send a test to one address, then broadcast to the customer audience.
- Customers who order are automatically added to the marketing audience; every
  marketing email carries an unsubscribe link (UK soft opt-in posture).

## Non-Goals (YAGNI)

- Scheduling / send-later, segmentation beyond a single audience, A/B testing,
  bespoke analytics (Resend provides open/click stats).
- A standalone editor app (option C) — editing is admin-only.
- A storefront marketing-consent checkbox (relying on soft opt-in + unsubscribe).
- Editing the transactional emails in the editor.

## Locked Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Surface | **B only** — Medusa admin page (uses existing admin auth) |
| Capability | Compose **+ save + send** |
| Email scope | **Marketing only** (transactional stays code) |
| Audience | **Auto-add buyers** on `order.placed`; unsubscribe via Resend |
| Marketing "from" | `Strydr <hello@strydr.co.uk>` (separate sender from `orders@`) |
| Audience id | `RESEND_AUDIENCE_ID` env (audience created in Resend dashboard) |
| Personalization | `{{{contact.first_name|there}}}` merge tags via editor "Insert" button |

## Architecture

Five pieces, all in `apps/backend`:

### 1. `marketingEmail` module — persistence
- Folder `src/modules/marketing-email/`, module name `"marketingEmail"` (camelCase).
- Data model `marketing_email`:
  - `id` (pk), `name` (text), `subject` (text), `preheader` (text, nullable),
    `editor_json` (json — editor document for re-editing), `body_html` (text —
    composed body HTML), `status` (enum `draft|sending|sent`, default `draft`),
    `resend_broadcast_id` (text, nullable), `sent_at` (datetime, nullable).
  - Auto `created_at` / `updated_at` / `deleted_at`.
- Service extends `MedusaService({ MarketingEmail })` (CRUD only).
- Register in `medusa-config.ts`; **generate + run migrations** (`db:generate marketingEmail` → `db:migrate`).

### 2. `resendMarketing` module — Resend marketing API wrapper
- Folder `src/modules/resend-marketing/`, name `"resendMarketing"` (mirrors the
  `royalmail` module: thin, injectable, graceful-disable).
- Options (from env): `api_key`, `audience_id`, `from` (default
  `Strydr <hello@strydr.co.uk>`).
- Service methods (wrapping the `resend` SDK):
  - `isConfigured()` → has api_key + audience_id.
  - `upsertContact({ email, firstName })` → `resend.contacts.create/update` on the audience (idempotent by email; `unsubscribed: false` only on first add).
  - `sendTest({ to, subject, html })` → `resend.emails.send` (single recipient, from marketing sender).
  - `createBroadcast({ subject, html })` → `resend.broadcasts.create({ audienceId, from, subject, html })` → returns broadcast id.
  - `sendBroadcast(id)` → `resend.broadcasts.send(id)`.

### 3. Audience-sync subscriber
- `src/subscribers/order-placed-audience.ts` on `order.placed` →
  `syncContactToAudienceWorkflow({ order_id })`.
- Error-isolated (log, never throw); no-op if `resendMarketing` not configured.
- Note: this is the **third** `order.placed` subscriber (email, royalmail, audience) — all independent.

### 4. Admin API routes (`src/api/admin/marketing-emails/`)
All under `/admin` (authenticated), each delegating to a workflow:
- `route.ts` → `GET` (list), `POST` (create draft)
- `[id]/route.ts` → `GET`, `POST` (update), `DELETE`
- `[id]/test/route.ts` → `POST { to }` (send test)
- `[id]/send/route.ts` → `POST` (send broadcast)

### 5. Admin UI page (`src/admin/routes/marketing/`)
- `page.tsx` with `defineRouteConfig({ label: "Marketing", icon })` → sidebar item.
- List view: table of `marketing_email` rows (name, subject, status, sent_at).
- Editor view: `@react-email/editor` `<EmailEditor>` bound to `editor_json`,
  plus name/subject/preheader fields and actions **Save · Send test · Send**.
- On Save: client composes body HTML from editor content via `composeReactEmail`,
  POSTs `editor_json` + `body_html`.
- Built with `@medusajs/ui` chrome; all backend calls via `sdk.client.fetch`
  (admin SDK — required for auth headers).

## Workflows (all mutations)

- `createMarketingEmailWorkflow`, `updateMarketingEmailWorkflow`,
  `deleteMarketingEmailWorkflow` — CRUD via module service.
- `sendMarketingTestWorkflow({ id, to })` — load row → wrap body → `resendMarketing.sendTest`.
- `sendMarketingBroadcastWorkflow({ id })` — set `status=sending` → wrap body →
  `createBroadcast` → `sendBroadcast` → `status=sent`, store `resend_broadcast_id` + `sent_at`.
  On failure, compensation reverts `status` to `draft`.
- `syncContactToAudienceWorkflow({ order_id })` — `useQueryGraphStep` (email,
  shipping_address.first_name) → `resendMarketing.upsertContact`.

## Brand wrapping & unsubscribe

The editor produces the **body HTML**. At test/send time the workflow wraps it
server-side in a **marketing brand shell** via a string-level HTML template
(`wrapMarketingHtml(bodyHtml, { preheader })`) — the same dark header/footer
band markup as the transactional emails (extract the header/footer markup from
`emails/components/brand.tsx` into a shared string template so both the
react-email components and this wrapper stay in sync), with the editor body
injected between them and a footer containing `{{{RESEND_UNSUBSCRIBE_URL}}}`. A
string wrapper (not a react-email render) is used deliberately because the body
is already-rendered HTML, not JSX. This guarantees brand consistency + a
compliant unsubscribe link regardless of editor content.

### Unsubscribe mechanics (Resend-owned)

- Resend handles the entire unsubscribe flow for broadcasts — **no endpoint,
  webhook, or suppression list on our side.** We only ensure the link is present.
- The footer's `{{{RESEND_UNSUBSCRIBE_URL}}}` is swapped per-recipient at send
  time; Resend also auto-adds `List-Unsubscribe` + `List-Unsubscribe-Post`
  headers, giving native one-click unsubscribe in Gmail/Apple Mail (also a
  bulk-sender deliverability requirement).
- Clicking unsubscribe hits Resend's **hosted** page and sets the contact's
  `unsubscribed: true` in the Audience; Resend automatically **excludes
  unsubscribed contacts from all future broadcasts**. Resend is the source of
  truth — we never store unsubscribe state.
- **Never auto-resubscribe:** the `order.placed` sync sets `unsubscribed: false`
  only when *first* creating a contact, never on update, so a returning buyer
  who opted out stays opted out.
- **Transactional unaffected:** order-placed / order-shipped go via transactional
  `emails.send` (not the Audience), so unsubscribed customers still receive
  order updates — correct for service emails, which aren't marketing.

## Configuration (env)

| Var | Purpose | Notes |
|---|---|---|
| `RESEND_API_KEY` | existing | reused |
| `RESEND_AUDIENCE_ID` | target Audience | user creates Audience in Resend, sets id (Dokploy) |
| `RESEND_MARKETING_FROM` | marketing sender | default `Strydr <hello@strydr.co.uk>`; verify sender/domain in Resend |

`docker-compose.yml` passes the two new vars through. Marketing send/sync
disabled gracefully when `RESEND_AUDIENCE_ID` is unset.

## Dependencies

- `@react-email/editor` (+ its theme CSS) — new; must bundle into the Medusa
  **admin** build (React 18.3). **This is the primary risk — see spike.**
- Reuses existing `resend`, `@react-email/components`.

## Compatibility Spike (implementation step 1 — gate)

Before building the real UI: a throwaway admin route renders `<EmailEditor>`;
confirm `medusa build` (admin) succeeds and the page loads in `/app`.
- **Pass → Approach 1** (full visual editor).
- **Fail → Approach 2 fallback:** replace the editor with a lighter composer
  (markdown / rich-text + brand wrapper + live preview) in the **same page
  shell**. Module, service, subscriber, routes, broadcasts are identical either
  way — only the compose surface changes.

## Error Handling

- Send/test failures → error toast in admin; broadcast workflow compensation
  keeps `status=draft`.
- Audience-sync subscriber errors logged, never thrown.
- Missing `RESEND_AUDIENCE_ID` → send disabled with a clear admin message; sync no-ops.

## Testing / Verification

- `medusa build` green; migrations applied.
- Create → save → reload a draft (editor_json round-trips).
- Send test to a real inbox; confirm brand shell + unsubscribe link render.
- Real broadcast to a **1-contact test audience** (your address); confirm
  delivery + unsubscribe.
- Place a test order → contact appears in the Resend Audience.

## Open Questions

None — all resolved in brainstorming.
