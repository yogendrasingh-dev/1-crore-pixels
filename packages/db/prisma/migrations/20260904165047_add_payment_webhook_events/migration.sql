-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_provider_event_id_key" ON "payment_webhook_events"("provider", "provider_event_id");
