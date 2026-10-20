# 🔄 ĐỊNH DẠNG PHẢN HỒI API & CHECKLIST REVIEW

Để Frontend dễ dàng bóc tách dữ liệu và đồng nhất với Backend, toàn bộ API của BrewLite phải tuân theo chuẩn định dạng này.

---

## 1. PHẢN HỒI THÀNH CÔNG (SUCCESS RESPONSE FORMAT)

Tất cả các API thành công (Status code 200, 201) đều được bọc tự động qua `TransformInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "clx...",
    "name": "Cà phê sữa đá",
    "basePrice": 35000
  },
  "timestamp": "2026-10-06T15:00:00.000Z"
}
```

* Nếu trả về danh sách: `data` là một mảng `[...]`.
* Nếu là thao tác tạo mới (201): `statusCode: 201`.

---

## 2. PHẢN HỒI LỖI (ERROR RESPONSE FORMAT)

Khi xảy ra lỗi (Status code 400, 401, 403, 404, 500), được bọc tự động qua `AllExceptionsFilter`:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Số lượng sản phẩm trong kho không đủ",
  "timestamp": "2026-10-06T15:00:00.000Z",
  "path": "/api/v1/orders"
}
```

* Nếu lỗi validate DTO (ValidationPipe): `message` là một mảng các thông báo lỗi cụ thể (ví dụ: `["email must be an email", "password must be longer than 6 characters"]`).

---

## 3. CHECKLIST REVIEW CODE TRƯỚC KHI MERGE (DÀNH CHO NGƯỜI REVIEW)

Trước khi duyệt bất kỳ Pull Request nào vào nhánh `develop`, người review phải kiểm tra danh sách sau:

- [ ] **Bảo mật:** Không commit file `.env`, không hardcode password, secret key hoặc token.
- [ ] **Kiểm thử biên dịch:** Chạy `npm run build` trên cả `backend/` và `frontend/` không phát sinh lỗi TypeScript.
- [ ] **Validation:** Phía Backend, tất cả request body đều có DTO kèm decorator `class-validator` (ví dụ: `@IsNotEmpty()`, `@IsString()`).
- [ ] **Quy chuẩn tên:** Tên biến, hàm, endpoint tuân thủ đúng `naming-convention.md`.
- [ ] **Xử lý bất đồng bộ:** Sử dụng đúng `async/await` và có xử lý bắt lỗi (try/catch hoặc để ExceptionFilter xử lý).
- [ ] **Giao diện:** Phía Frontend có xử lý đầy đủ các trạng thái `loading` (spinner/skeleton) và `error`.

---

## 4. QUYẾT ĐỊNH ĐẶC THÙ THEO GIAI ĐOẠN (SPRINT MILESTONES)

* **Miễn trừ Wireframe / Figma ở Tuần 1 (Foundation Review):**
  Theo quyết định chính thức của Nhóm trưởng (Phạm Minh Chiến), toàn bộ 4 feature trong Tuần 1 (`feat/product-catalog`, `feat/product-detail`, `feat/cart-state`, `feat/mock-payment`) được **miễn trừ kiểm tra tiêu chí Wireframe/Figma trực quan** nhằm tập trung hoàn thiện và Freeze kiến trúc kỹ thuật (Use Case Specification, Activity Flow, API Contract, DB Mapping, FE/BE Skeleton). Các màn hình được mô tả trực quan thông qua text component states trong tài liệu đặc tả và tiến hành code UI trực tiếp ở Sprint 2.

