ALTER TABLE "payments"
ADD COLUMN "gateway_order_id" TEXT,
ADD COLUMN "payment_url" TEXT;

CREATE UNIQUE INDEX "payments_gateway_order_id_key" ON "payments"("gateway_order_id");
