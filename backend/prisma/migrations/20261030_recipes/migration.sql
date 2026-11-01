CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'PIECE');

CREATE TABLE "ingredients" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "name_key" TEXT NOT NULL,
  "unit" "IngredientUnit" NOT NULL,
  CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ingredients_name_key_key" ON "ingredients"("name_key");

CREATE TABLE "recipe_ingredients" (
  "product_id" TEXT NOT NULL,
  "size" "ProductSize" NOT NULL,
  "ingredient_id" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("product_id", "size", "ingredient_id"),
  CONSTRAINT "recipe_ingredients_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 1000000),
  CONSTRAINT "recipe_ingredients_product_id_size_fkey" FOREIGN KEY ("product_id", "size") REFERENCES "product_size_prices"("product_id", "size") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients"("ingredient_id");
