/**
 * Ảnh sản phẩm thật được đặt trong `public/images/menu/`.
 * Tên file dùng slug của tên sản phẩm (không dấu, gạch nối).
 * Nếu chưa có ảnh local, dùng `imageUrl` từ API, cuối cùng là ảnh placeholder.
 */
const LOCAL_PRODUCT_IMAGES: Record<string, string> = {
  americano: '/images/menu/americano.jpg',
  'bac-xiu': '/images/menu/bac-xiu.jpg',
  cappuccino: '/images/menu/cappuccino.jpg',
  'cold-brew-cam': '/images/menu/cold-brew-cam.jpg',
  'ca-phe-sua-da': '/images/menu/ca-phe-sua-da.jpg',
  'tra-sua-truyen-thong': '/images/menu/tra-sua.jpg',
  'tra-vai': '/images/menu/tra-vai.jpg',
  'tra-dao-cam-sa': '/images/menu/tra-dao-cam-sa.jpg',
};

export const FALLBACK_PRODUCT_IMAGE = '/images/placeholder.svg';

export function slugifyProductName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveProductImage(product: { name: string; imageUrl?: string | null }): string {
  return LOCAL_PRODUCT_IMAGES[slugifyProductName(product.name)] || product.imageUrl || FALLBACK_PRODUCT_IMAGE;
}

export function resolveProductImageByName(name: string, fallback?: string | null): string {
  return LOCAL_PRODUCT_IMAGES[slugifyProductName(name)] || fallback || FALLBACK_PRODUCT_IMAGE;
}
