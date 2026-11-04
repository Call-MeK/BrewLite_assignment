CREATE TYPE "PaymentSource" AS ENUM ('MOCK', 'ZALOPAY_SANDBOX');

ALTER TABLE "payments"
  ADD COLUMN "source" "PaymentSource" NOT NULL DEFAULT 'MOCK',
  ADD COLUMN "provider_order_id" TEXT,
  ADD COLUMN "provider_transaction_id" TEXT,
  ADD COLUMN "payment_url" TEXT,
  ADD COLUMN "provider_amount" DECIMAL(12,0),
  ADD COLUMN "review_reason" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_provider_order_id_key" ON "payments"("provider_order_id");
CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider_transaction_id");
CREATE INDEX "payments_source_created_at_idx" ON "payments"("source", "created_at");
