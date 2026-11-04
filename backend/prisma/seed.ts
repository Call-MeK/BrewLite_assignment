import { PrismaClient, ProductSize } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { additionalMenuItems } from "./additional-menu-items";
import { ingredientSeeds } from "./ingredients-data";
import { recipeQuantity, recipeTemplates } from "./recipes-data";
import { sampleStockImport, sampleStockImportTotal } from "./stock-import-data";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Bắt đầu nạp dữ liệu mẫu (Seeding BrewLite DB)...");

  // 1. Xóa dữ liệu cũ theo thứ tự quan hệ
  await prisma.orderItemTopping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderIngredient.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.stockImportItem.deleteMany();
  await prisma.stockImport.deleteMany();
  await prisma.productSizePrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.user.deleteMany();
  await prisma.ingredient.deleteMany();

  // 2. Tạo User Demo
  const passwordHash = await bcrypt.hash("Demo@12345", 10);
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@brewlite.test",
      passwordHash,
      fullName: "Khách hàng Demo",
      loyaltyPoints: 120, // Có sẵn 120 điểm loyalty
    },
  });
  console.log(`✅ Đã tạo user demo: ${demoUser.email} / Mật khẩu: Demo@12345`);

  // 3. Tạo Categories
  const catCoffee = await prisma.category.create({
    data: {
      name: "Cà phê",
      slug: "ca-phe",
      displayOrder: 1,
    },
  });

  const catTea = await prisma.category.create({
    data: {
      name: "Trà & Trái cây",
      slug: "tra-trai-cay",
      displayOrder: 2,
    },
  });
  console.log("✅ Đã tạo 2 danh mục: Cà phê, Trà & Trái cây");

  // 4. Tạo Toppings
  const toppingBoba = await prisma.topping.create({
    data: {
      name: "Trân châu hoàng kim",
      price: 5000,
      stock: 200,
    },
  });

  const toppingCheese = await prisma.topping.create({
    data: {
      name: "Vải",
      price: 8000,
      stock: 150,
    },
  });

  const toppingPeach = await prisma.topping.create({
    data: {
      name: "Đác thơm",
      price: 8000,
      stock: 100,
    },
  });
  console.log(
    "✅ Đã tạo 3 topping: Trân châu hoàng kim (5k), Vải (8k), Đác thơm (8k)",
  );

  // 5. Tạo Sản phẩm kèm giá Size phụ thu (S: 0, M: +5k, L: +10k)
  const productsData = [
    {
      categoryId: catCoffee.id,
      name: "Cà phê sữa đá",
      basePrice: 35000,
      imageUrl:
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
    },
    {
      categoryId: catCoffee.id,
      name: "Americano",
      basePrice: 40000,
      imageUrl:
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600",
    },
    {
      categoryId: catCoffee.id,
      name: "Cappuccino",
      basePrice: 45000,
      imageUrl:
        "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600",
    },
    {
      categoryId: catTea.id,
      name: "Trà đào cam sả",
      basePrice: 39000,
      imageUrl:
        "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600",
    },
    ...additionalMenuItems.map(({ categorySlug, stock, ...item }) => ({
      ...item,
      categoryId: categorySlug === "ca-phe" ? catCoffee.id : catTea.id,
    })),
  ];

  const productIds = new Map<string, string>();
  for (const item of productsData) {
    const product = await prisma.product.create({
      data: {
        ...item,
        stock: 100,
        sizePrices: {
          create: [
            { size: ProductSize.S, priceAdjustment: 0 },
            { size: ProductSize.M, priceAdjustment: 5000 },
            { size: ProductSize.L, priceAdjustment: 10000 },
          ],
        },
      },
    });
    productIds.set(product.name, product.id);
    console.log(
      `✅ Đã tạo sản phẩm: ${product.name} (Base: ${product.basePrice}đ) kèm size S/M/L`,
    );
  }
  // KHỞI TẠO NGUYÊN LIỆU & CÔNG THỨC
  await prisma.ingredient.createMany({
    data: ingredientSeeds.map((item) => ({
      ...item,
      nameKey: item.name.toLowerCase(),
    })),
  });
  console.log(`✅ Đã tạo ${ingredientSeeds.length} nguyên liệu cho kho`);

  const allIngredients = await prisma.ingredient.findMany();
  const ingredientByName = new Map(allIngredients.map((item) => [item.name, item]));
  const recipeRows = recipeTemplates.flatMap((template) => {
    const productId = productIds.get(template.productName);
    if (!productId) return [];
    return ([ProductSize.S, ProductSize.M, ProductSize.L] as ProductSize[]).flatMap(
      (size) =>
        template.ingredients.map((item) => ({
          productId,
          size,
          ingredientId: ingredientByName.get(item.ingredientName)!.id,
          quantity: recipeQuantity(item.quantity, size),
        })),
    );
  });
  await prisma.recipeIngredient.createMany({ data: recipeRows });
  console.log(
    `✅ Đã tạo ${recipeRows.length} dòng công thức cho ${recipeTemplates.length} món × 3 size`,
  );

  // Phiếu nhập mẫu để trang Nhập hàng có dữ liệu ngay sau khi seed.
  const sampleItems = sampleStockImport.items.map((item) => {
    const ingredient = ingredientByName.get(item.ingredientName);
    if (!ingredient) {
      throw new Error(`Thiếu nguyên liệu cho phiếu nhập mẫu: ${item.ingredientName}`);
    }
    return { ...item, ingredientId: ingredient.id };
  });
  await prisma.stockImport.create({
    data: {
      supplier: sampleStockImport.supplier,
      note: sampleStockImport.note,
      totalAmount: sampleStockImportTotal,
      createdBy: sampleStockImport.createdBy,
      items: {
        create: sampleItems.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        })),
      },
    },
  });
  for (const item of sampleItems) {
    await prisma.ingredient.update({
      where: { id: item.ingredientId },
      data: {
        stock: { increment: item.quantity },
        price: item.unitPrice,
        version: { increment: 1 },
      },
    });
  }
  console.log(
    `✅ Đã tạo phiếu nhập mẫu với ${sampleItems.length} nguyên liệu`,
  );

  // 6. Tạo Promotions (Vouchers)
  await prisma.promotion.createMany({
    data: [
      {
        code: "WELCOME10",
        description: "Giảm 10% tối đa 20.000đ cho đơn từ 40.000đ",
        discountPercent: 10,
        maxDiscount: 20000,
        minOrderAmount: 40000,
        isActive: true,
      },
      {
        code: "GIAM15K",
        description: "Giảm thẳng 15.000đ cho đơn từ 60.000đ",
        discountAmount: 15000,
        minOrderAmount: 60000,
        isActive: true,
      },
    ],
  });
  console.log("✅ Đã tạo 2 voucher khuyến mãi: WELCOME10, GIAM15K");

  console.log("🎉 Hoàn tất nạp dữ liệu mẫu cho BrewLite!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed DB:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
