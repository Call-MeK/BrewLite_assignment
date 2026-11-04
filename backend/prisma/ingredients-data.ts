import { IngredientUnit } from "@prisma/client";

export type IngredientSeed = {
  name: string;
  unit: IngredientUnit;
  stock: number;
  price: number;
};

// Danh sách nguyên liệu dùng chung cho seed và script bổ sung kho.
// price = giá vốn trên 1 đơn vị (VNĐ/g, VNĐ/ml hoặc VNĐ/piece).
export const ingredientSeeds: IngredientSeed[] = [
  // Cà phê
  { name: "Cà phê hạt Arabica", unit: "G", stock: 5000, price: 320 },
  { name: "Cà phê hạt Robusta", unit: "G", stock: 4000, price: 210 },
  // Sữa & kem
  { name: "Sữa tươi", unit: "ML", stock: 12000, price: 26 },
  { name: "Sữa đặc", unit: "G", stock: 5000, price: 48 },
  { name: "Kem sữa béo", unit: "ML", stock: 3000, price: 95 },
  // Trà
  { name: "Trà đen", unit: "G", stock: 2500, price: 180 },
  { name: "Trà lài", unit: "G", stock: 1500, price: 240 },
  { name: "Trà oolong", unit: "G", stock: 1000, price: 220 },
  { name: "Trà xanh", unit: "G", stock: 1200, price: 200 },
  // Trái cây tươi & ngâm
  { name: "Đào ngâm", unit: "G", stock: 3000, price: 95 },
  { name: "Vải ngâm", unit: "G", stock: 3000, price: 85 },
  { name: "Cam tươi", unit: "PIECE", stock: 200, price: 12000 },
  { name: "Sả tươi", unit: "G", stock: 1200, price: 25 },
  { name: "Chanh dây", unit: "G", stock: 800, price: 65 },
  // Syrup & sốt
  { name: "Syrup đường", unit: "ML", stock: 5000, price: 12 },
  { name: "Syrup đào", unit: "ML", stock: 2000, price: 42 },
  { name: "Syrup vải", unit: "ML", stock: 2000, price: 42 },
  { name: "Syrup caramel", unit: "ML", stock: 1500, price: 48 },
  { name: "Sốt socola", unit: "ML", stock: 1000, price: 60 },
  // Topping & phụ liệu
  { name: "Trân châu hoàng kim", unit: "G", stock: 3000, price: 55 },
  { name: "Đác thơm", unit: "G", stock: 1500, price: 90 },
  { name: "Đá viên", unit: "G", stock: 20000, price: 1 },
  { name: "Đường cát", unit: "G", stock: 5000, price: 18 },
  { name: "Bột quế", unit: "G", stock: 300, price: 260 },
];
