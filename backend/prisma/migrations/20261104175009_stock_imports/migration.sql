-- CreateTable
CREATE TABLE "stock_imports" (
    "id" TEXT NOT NULL,
    "import_number" SERIAL NOT NULL,
    "supplier" VARCHAR(120),
    "note" VARCHAR(500),
    "total_amount" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "created_by" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_import_items" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "line_total" DECIMAL(14,0) NOT NULL,

    CONSTRAINT "stock_import_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_imports_import_number_key" ON "stock_imports"("import_number");

-- CreateIndex
CREATE INDEX "stock_imports_created_at_idx" ON "stock_imports"("created_at");

-- CreateIndex
CREATE INDEX "stock_import_items_import_id_idx" ON "stock_import_items"("import_id");

-- CreateIndex
CREATE INDEX "stock_import_items_ingredient_id_idx" ON "stock_import_items"("ingredient_id");

-- AddForeignKey
ALTER TABLE "stock_import_items" ADD CONSTRAINT "stock_import_items_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "stock_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_import_items" ADD CONSTRAINT "stock_import_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
