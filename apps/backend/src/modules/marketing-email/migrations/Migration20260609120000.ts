import { Migration } from "@mikro-orm/migrations"

export class Migration20260609120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "marketing_email" ("id" text not null, "name" text not null, "subject" text not null, "preheader" text null, "editor_json" jsonb null, "body_html" text null, "status" text check ("status" in ('draft', 'sending', 'sent')) not null default 'draft', "resend_broadcast_id" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_email_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_marketing_email_deleted_at" ON "marketing_email" (deleted_at) WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_email" cascade;`)
  }
}
