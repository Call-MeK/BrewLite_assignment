-- Remove MoMo source and legacy ZaloPay payment column.
-- The extra `gateway_order_id` column/index came from an obsolete migration
-- (20261020_zalopay_payment) that is no longer part of the local history.
-- All rows are NULL in that column, so dropping it loses no data.

CREATE TYPE "PaymentSource_new" AS ENUM ('MOCK', 'ZALOPAY_SANDBOX');
ALTER TABLE "public"."payments" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "source" TYPE "PaymentSource_new" USING ("source"::text::"PaymentSource_new");
ALTER TYPE "PaymentSource" RENAME TO "PaymentSource_old";
ALTER TYPE "PaymentSource_new" RENAME TO "PaymentSource";
DROP TYPE "public"."PaymentSource_old";
ALTER TABLE "payments" ALTER COLUMN "source" SET DEFAULT 'MOCK';

DROP INDEX IF EXISTS "payments_gateway_order_id_key";
ALTER TABLE "ingredients" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "payments" DROP COLUMN IF EXISTS "gateway_order_id";
