# 🏷️ TIÊU CHUẨN ĐẶT TÊN DỰ ÁN (NAMING CONVENTION)

Áp dụng cho 6 feature và toàn bộ thành viên nhóm BrewLite để mã nguồn đồng nhất từ Frontend, Backend đến Database.

---

## 1. RESTFUL API NAMING CONVENTION

* **Quy tắc URL:** Dùng chữ thường, danh từ số nhiều, ngăn cách bằng gạch nối (`kebab-case`) nếu có nhiều từ.
* **Tiền tố chung:** `/api/v1`

| Phương thức (Method) | Endpoint | Ý nghĩa | Status Code thành công |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/products` | Lấy danh sách menu sản phẩm | 200 OK |
| `GET` | `/api/v1/products/:id` | Lấy chi tiết 1 sản phẩm | 200 OK |
| `POST` | `/api/v1/auth/register` | Đăng ký tài khoản mới | 201 Created |
| `POST` | `/api/v1/auth/login` | Đăng nhập và nhận Bearer JWT | 200 OK |
| `POST` | `/api/v1/orders` | Tạo đơn hàng mới (`PENDING`) | 201 Created |
| `POST` | `/api/v1/orders/:id/cancel` | Hủy đơn hàng (`PENDING`/`PAYMENT_FAILED` → `CANCELLED`) | 200 OK |
| `GET` | `/api/v1/orders/me` | Lấy lịch sử đơn hàng của người dùng | 200 OK |
| `POST` | `/api/v1/payments` | Thanh toán đơn hàng (kèm `Idempotency-Key` header) | 200 OK / 201 Created |

---

## 2. DATABASE & PRISMA NAMING CONVENTION

* **Tên bảng vật lý trong PostgreSQL:** `snake_case`, số nhiều:
  - `users`, `products`, `orders`, `order_items`, `payments`
* **Tên Model trong Prisma (`schema.prisma`):** `PascalCase`, số ít:
  - `User`, `Product`, `Order`, `OrderItem`, `Payment`
* **Tên trường (Fields/Columns):**
  - Trong TypeScript & Prisma model: `camelCase` (ví dụ: `passwordHash`, `loyaltyPoints`, `totalAmount`).
  - Trong cơ sở dữ liệu: map tự động hoặc chỉ định `snake_case` (ví dụ: `password_hash`, `total_amount`).
* **Khóa chính (Primary Key):** Luôn đặt tên là `id` (kiểu `String` dùng CUID hoặc UUID).
* **Khóa ngoại (Foreign Key):** `<tên_thực_thể>Id` (ví dụ: `userId`, `orderId`, `productId`).

---

## 3. CODE CONVENTION (NESTJS & NEXTJS)

### Phía Backend (NestJS):
* **Class & Interface / DTO:** `PascalCase` (ví dụ: `CreateOrderDto`, `ProductsService`, `UserResponse`).
* **Hàm & Biến:** `camelCase` (ví dụ: `getProductById()`, `calculateTotalAmount()`).
* **Tên file:** `<tên-module>.<loại-file>.ts` (`kebab-case`):
  - Controller: `products.controller.ts`
  - Service: `products.service.ts`
  - DTO: `create-order.dto.ts`
  - Module: `products.module.ts`

### Phía Frontend (Next.js):
* **Components:** `PascalCase` cho tên hàm và tên file (ví dụ: `ProductCard.tsx`, `CartDrawer.tsx`, `Navbar.tsx`).
* **Hooks:** Bắt đầu bằng `use`, dùng `camelCase` (ví dụ: `useCartStore.ts`, `useAuth.ts`).
* **Thư mục routes (App Router):** `kebab-case` (ví dụ: `app/menu/page.tsx`, `app/orders/history/page.tsx`).

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D6 (ngày 2026-10-16).*
