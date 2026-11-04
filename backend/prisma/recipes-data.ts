import { ProductSize } from "@prisma/client";

export type RecipeTemplate = {
  productName: string;
  // Định lượng cho size S; size M/L nhân theo hệ số bên dưới.
  ingredients: { ingredientName: string; quantity: number }[];
};

export const sizeFactor: Record<ProductSize, number> = {
  S: 1,
  M: 1.3,
  L: 1.6,
};

export function recipeQuantity(base: number, size: ProductSize) {
  return Math.round(base * sizeFactor[size] * 1000) / 1000;
}

// Công thức chuẩn cho 8 món đang bán. Đơn vị theo đơn vị của từng nguyên liệu.
export const recipeTemplates: RecipeTemplate[] = [
  {
    productName: "Americano",
    ingredients: [
      { ingredientName: "Cà phê hạt Arabica", quantity: 18 },
      { ingredientName: "Syrup đường", quantity: 5 },
      { ingredientName: "Đá viên", quantity: 150 },
    ],
  },
  {
    productName: "Bạc xỉu",
    ingredients: [
      { ingredientName: "Cà phê hạt Robusta", quantity: 18 },
      { ingredientName: "Sữa tươi", quantity: 80 },
      { ingredientName: "Sữa đặc", quantity: 20 },
      { ingredientName: "Đá viên", quantity: 150 },
    ],
  },
  {
    productName: "Cappuccino",
    ingredients: [
      { ingredientName: "Cà phê hạt Arabica", quantity: 18 },
      { ingredientName: "Sữa tươi", quantity: 120 },
      { ingredientName: "Kem sữa béo", quantity: 30 },
      { ingredientName: "Bột quế", quantity: 1 },
    ],
  },
  {
    productName: "Cold brew cam",
    ingredients: [
      { ingredientName: "Cà phê hạt Arabica", quantity: 22 },
      { ingredientName: "Cam tươi", quantity: 1 },
      { ingredientName: "Syrup đường", quantity: 15 },
      { ingredientName: "Đá viên", quantity: 180 },
    ],
  },
  {
    productName: "Cà phê sữa đá",
    ingredients: [
      { ingredientName: "Cà phê hạt Robusta", quantity: 20 },
      { ingredientName: "Sữa đặc", quantity: 30 },
      { ingredientName: "Sữa tươi", quantity: 40 },
      { ingredientName: "Đá viên", quantity: 150 },
    ],
  },
  {
    productName: "Trà sữa truyền thống",
    ingredients: [
      { ingredientName: "Trà đen", quantity: 8 },
      { ingredientName: "Sữa tươi", quantity: 100 },
      { ingredientName: "Sữa đặc", quantity: 20 },
      { ingredientName: "Trân châu hoàng kim", quantity: 50 },
      { ingredientName: "Syrup đường", quantity: 10 },
      { ingredientName: "Đá viên", quantity: 120 },
    ],
  },
  {
    productName: "Trà vải",
    ingredients: [
      { ingredientName: "Trà lài", quantity: 8 },
      { ingredientName: "Vải ngâm", quantity: 60 },
      { ingredientName: "Syrup vải", quantity: 20 },
      { ingredientName: "Đá viên", quantity: 150 },
    ],
  },
  {
    productName: "Trà đào cam sả",
    ingredients: [
      { ingredientName: "Trà đen", quantity: 8 },
      { ingredientName: "Đào ngâm", quantity: 60 },
      { ingredientName: "Cam tươi", quantity: 0.5 },
      { ingredientName: "Sả tươi", quantity: 10 },
      { ingredientName: "Syrup đào", quantity: 20 },
      { ingredientName: "Đá viên", quantity: 150 },
    ],
  },
];
