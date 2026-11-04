ALTER TYPE "LoyaltyTransactionType" ADD VALUE 'REVERSED';
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'MANUAL_REQUIRED');
ALTER TABLE "orders" ADD COLUMN "refund_status" "RefundStatus" NOT NULL DEFAULT 'NONE';
