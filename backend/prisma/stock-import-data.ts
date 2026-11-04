// Phiếu nhập mẫu dùng chung cho seed và script bổ sung dữ liệu.
export const sampleStockImport = {
  supplier: "Cà phê Đắk Lắk",
  note: "Phiếu nhập mẫu đầu kỳ",
  createdBy: "Phiếu mẫu",
  items: [
    { ingredientName: "Cà phê hạt Arabica", quantity: 5000, unitPrice: 320 },
    { ingredientName: "Sữa tươi", quantity: 10000, unitPrice: 26 },
    { ingredientName: "Đá viên", quantity: 20000, unitPrice: 1 },
    { ingredientName: "Cam tươi", quantity: 100, unitPrice: 12000 },
  ],
};

export const sampleStockImportTotal = sampleStockImport.items.reduce(
  (sum, item) => sum + item.quantity * item.unitPrice,
  0,
);
