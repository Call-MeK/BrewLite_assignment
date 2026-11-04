ALTER TABLE "ingredients"
  ADD COLUMN "stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "order_ingredients" (
  "order_id" TEXT NOT NULL,
  "ingredient_id" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "order_ingredients_pkey" PRIMARY KEY ("order_id", "ingredient_id"),
  CONSTRAINT "order_ingredients_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
