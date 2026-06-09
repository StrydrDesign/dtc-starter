import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Skeleton, Table, Text } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { sdk } from "../../lib/sdk"

type MarketingEmail = {
  id: string
  name: string
  subject: string
  status: "draft" | "sending" | "sent"
  sent_at: string | null
}

type ListResponse = {
  marketing_emails: MarketingEmail[]
  count: number
}

type CreateResponse = {
  marketing_email: MarketingEmail
}

const statusColor = (
  status: MarketingEmail["status"]
): "green" | "grey" | "orange" => {
  if (status === "sent") return "green"
  if (status === "sending") return "orange"
  return "grey"
}

const MarketingPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-emails"],
    queryFn: () =>
      sdk.client.fetch<ListResponse>("/admin/marketing-emails"),
  })

  const createDraft = useMutation({
    mutationFn: () =>
      sdk.client.fetch<CreateResponse>("/admin/marketing-emails", {
        method: "POST",
        body: { name: "Untitled", subject: "Untitled" },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-emails"] })
      navigate(`/marketing/${result.marketing_email.id}`)
    },
  })

  const rows = data?.marketing_emails ?? []

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Marketing</Heading>
        <Button
          size="small"
          variant="primary"
          onClick={() => createDraft.mutate()}
          isLoading={createDraft.isPending}
          disabled={createDraft.isPending}
        >
          New email
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 px-6 py-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-4">
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            No marketing emails yet. Create one to get started.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Subject</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Sent</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row
                key={row.id}
                className="cursor-pointer [&_td:last-child]:w-[1%] [&_td:last-child]:whitespace-nowrap"
                onClick={() => navigate(`/marketing/${row.id}`)}
              >
                <Table.Cell>
                  <Text size="small" leading="compact" weight="plus">
                    {row.name}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {row.subject}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={statusColor(row.status)} size="2xsmall">
                    {row.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {row.sent_at
                      ? new Date(row.sent_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Marketing",
  icon: Envelope,
})

export default MarketingPage
