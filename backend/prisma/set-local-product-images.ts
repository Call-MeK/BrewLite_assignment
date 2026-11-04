/**
 * Trỏ ảnh sản phẩm trong DB về ảnh thật nằm trong `frontend/public/images/menu/`.
 *
 * Chạy trong thư mục `backend/`:
 *   npx ts-node -r dotenv/config prisma/set-local-product-images.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const images: Array<[name: string, path: string]> = [
  ['Americano', '/images/menu/americano.jpg'],
  ['Bạc xỉu', '/images/menu/bac-xiu.jpg'],
  ['Cappuccino', '/images/menu/cappuccino.jpg'],
  ['Cold brew cam', '/images/menu/cold-brew-cam.jpg'],
  ['Cà phê sữa đá', '/images/menu/ca-phe-sua-da.jpg'],
  ['Trà sữa truyền thống', '/images/menu/tra-sua.jpg'],
  ['Trà vải', '/images/menu/tra-vai.jpg'],
  ['Trà đào cam sả', '/images/menu/tra-dao-cam-sa.jpg'],
];

async function main() {
  for (const [name, path] of images) {
    const result = await prisma.product.updateMany({ where: { name }, data: { imageUrl: path } });
    console.log(`${name}: ${result.count} sản phẩm -> ${path}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
