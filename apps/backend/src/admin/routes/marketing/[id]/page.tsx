import { EmailEditor, type EmailEditorRef } from "@react-email/editor"
import "@react-email/editor/themes/default.css"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Prompt,
  toast,
} from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { sdk } from "../../../lib/sdk"

// Nested route – no config/nav export (parent marketing/page.tsx owns the sidebar item)

type MarketingEmail = {
  id: string
  name: string
  subject: string
  preheader: string | null
  editor_json: unknown
  body_html: string | null
  status: string
}

const EditorPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  // The EmailEditor component exposes its API via a ref (EmailEditorRef).
  // EmailEditorRef has:
  //   getEmail()    → Promise<{ html: string; text: string }>   (renders to email HTML)
  //   getEmailHTML()→ Promise<string>
  //   getJSON()     → JSONContent  (TipTap JSON snapshot, synchronous)
  //   editor        → Editor | null  (TipTap editor instance)
  //
  // We store the live ref object via the onUpdate callback so we always
  // call into the latest editor state, not a stale closure.
  const editorRef = useRef<EmailEditorRef | null>(null)

  const [email, setEmail] = useState<MarketingEmail | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!id) return
    sdk.client
      .fetch<{ marketing_email: MarketingEmail }>(
        `/admin/marketing-emails/${id}`
      )
      .then((r) => {
        const m = r.marketing_email
        setEmail(m)
        setName(m.name)
        setSubject(m.subject)
        setPreheader(m.preheader ?? "")
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "Failed to load email"
        toast.error(msg)
      })
  }, [id])

  // Produces the body_html + editor_json snapshot from the current editor.
  // Uses ref.current.getEmail() which is the authoritative API for
  // rendering editor content → email-safe HTML. getJSON() captures the
  // TipTap document for round-tripping back into the editor on next load.
  const compose = async (): Promise<{
    editor_json: unknown
    body_html: string
  }> => {
    if (!editorRef.current) {
      throw new Error("Editor is not ready")
    }
    const editor_json = editorRef.current.getJSON()
    const { html: body_html } = await editorRef.current.getEmail()
    return { editor_json, body_html }
  }

  const save = async (): Promise<void> => {
    if (!id) return
    setSaving(true)
    try {
      const { editor_json, body_html } = await compose()
      await sdk.client.fetch(`/admin/marketing-emails/${id}`, {
        method: "POST",
        body: {
          name,
          subject,
          preheader: preheader.trim() || null,
          editor_json,
          body_html,
        },
      })
      toast.success("Saved")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (): Promise<void> => {
    if (!id) return
    // Save first so the backend uses the latest HTML
    await save()
    const to = window.prompt("Send a test to which email address?")
    if (!to?.trim()) return
    setSending(true)
    try {
      await sdk.client.fetch(`/admin/marketing-emails/${id}/test`, {
        method: "POST",
        body: { to: to.trim() },
      })
      toast.success(`Test sent to ${to.trim()}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test send failed"
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const sendBroadcast = async (): Promise<void> => {
    if (!id) return
    setSending(true)
    try {
      await save()
      await sdk.client.fetch(`/admin/marketing-emails/${id}/send`, {
        method: "POST",
      })
      toast.success("Broadcast sent to your audience")
      navigate("/marketing")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Broadcast failed"
      toast.error(msg)
      setSending(false)
    }
  }

  const isBusy = saving || sending

  if (!email) return null

  return (
    <Container className="p-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Edit email</Heading>
        <div className="flex gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={save}
            isLoading={saving}
            disabled={isBusy}
          >
            Save
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={sendTest}
            disabled={isBusy}
          >
            Send test
          </Button>
          <Prompt>
            <Prompt.Trigger asChild>
              <Button
                size="small"
                variant="primary"
                disabled={isBusy}
                isLoading={sending}
              >
                Send to audience
              </Button>
            </Prompt.Trigger>
            <Prompt.Content>
              <Prompt.Header>
                <Prompt.Title>Send broadcast?</Prompt.Title>
                <Prompt.Description>
                  This will email your entire marketing audience. This action
                  cannot be undone.
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

      {/* Metadata fields */}
      <div className="grid gap-3 px-6 pb-4">
        <div className="flex flex-col gap-1">
          <Label size="small">Internal name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer sale announcement"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Don't miss our summer sale"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="small">Preheader (inbox preview text)</Label>
          <Input
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Optional short summary shown after the subject line"
          />
        </div>
      </div>

      {/* Visual email editor
          - content: pass the stored TipTap JSON (or undefined for a blank doc).
            The editor accepts JSONContent | string | null | undefined for content.
          - onUpdate: fires on every keystroke; we capture the latest ref here
            so compose() always reads fresh state.
          - onReady: same — ensures editorRef is set as soon as the editor mounts.
      */}
      <div className="px-6 pb-6">
        <EmailEditor
          ref={editorRef}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={email.editor_json as any}
          onReady={(ref) => {
            editorRef.current = ref
          }}
          onUpdate={(ref) => {
            editorRef.current = ref
          }}
          theme="basic"
        />
      </div>
    </Container>
  )
}

export default EditorPage
