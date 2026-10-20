import { PrismaClient, ProductSize } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu nạp dữ liệu mẫu (Seeding BrewLite DB)...');

  // 1. Xóa dữ liệu cũ theo thứ tự quan hệ
  await prisma.orderItemTopping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productSizePrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.user.deleteMany();

  // 2. Tạo User Demo
  const passwordHash = await bcrypt.hash('Demo@12345', 10);
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@brewlite.test',
      passwordHash,
      fullName: 'Khách hàng Demo',
      loyaltyPoints: 120, // Có sẵn 120 điểm loyalty
    },
  });
  console.log(`✅ Đã tạo user demo: ${demoUser.email} / Mật khẩu: Demo@12345`);

  // 3. Tạo Categories
  const catCoffee = await prisma.category.create({
    data: {
      name: 'Cà phê',
      slug: 'ca-phe',
      displayOrder: 1,
    },
  });

  const catTea = await prisma.category.create({
    data: {
      name: 'Trà & Trái cây',
      slug: 'tra-trai-cay',
      displayOrder: 2,
    },
  });
  console.log('✅ Đã tạo 2 danh mục: Cà phê, Trà & Trái cây');

  // 4. Tạo Toppings
  const toppingBoba = await prisma.topping.create({
    data: {
      name: 'Trân châu trắng',
      price: 5000,
      stock: 200,
    },
  });

  const toppingCheese = await prisma.topping.create({
    data: {
      name: 'Kem Cheese',
      price: 10000,
      stock: 150,
    },
  });

  const toppingPeach = await prisma.topping.create({
    data: {
      name: 'Đào miếng',
      price: 8000,
      stock: 100,
    },
  });
  console.log('✅ Đã tạo 3 Topping: Trân châu trắng (5k), Kem Cheese (10k), Đào miếng (8k)');

  // 5. Tạo Sản phẩm kèm giá Size phụ thu (S: 0, M: +5k, L: +10k)
  const productsData = [
    {
      categoryId: catCoffee.id,
      name: 'Cà phê sữa đá',
      basePrice: 35000,
      imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600',
      stock: 100,
    },
    {
      categoryId: catCoffee.id,
      name: 'Americano',
      basePrice: 40000,
      imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
      stock: 80,
    },
    {
      categoryId: catCoffee.id,
      name: 'Cappuccino',
      basePrice: 45000,
      imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600',
      stock: 60,
    },
    {
      categoryId: catTea.id,
      name: 'Trà đào cam sả',
      basePrice: 39000,
      imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600',
      stock: 75,
    },
  ];

  for (const item of productsData) {
    const product = await prisma.product.create({
      data: {
        ...item,
        sizePrices: {
          create: [
            { size: ProductSize.S, priceAdjustment: 0 },
            { size: ProductSize.M, priceAdjustment: 5000 },
            { size: ProductSize.L, priceAdjustment: 10000 },
          ],
        },
      },
    });
    console.log(`✅ Đã tạo sản phẩm: ${product.name} (Base: ${product.basePrice}đ) kèm size S/M/L`);
  }

  // 6. Tạo Promotions (Vouchers)
  await prisma.promotion.createMany({
    data: [
      {
        code: 'WELCOME10',
        description: 'Giảm 10% tối đa 20.000đ cho đơn từ 40.000đ',
        discountPercent: 10,
        maxDiscount: 20000,
        minOrderAmount: 40000,
        isActive: true,
      },
      {
        code: 'GIAM15K',
        description: 'Giảm thẳng 15.000đ cho đơn từ 60.000đ',
        discountAmount: 15000,
        minOrderAmount: 60000,
        isActive: true,
      },
    ],
  });
  console.log('✅ Đã tạo 2 voucher khuyến mãi: WELCOME10, GIAM15K');

  console.log('🎉 Hoàn tất nạp dữ liệu mẫu cho BrewLite!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed DB:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
