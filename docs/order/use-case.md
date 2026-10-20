# Use Case: Create Order

> Feature: Order | Owner: Vo Thi Thuy | Phiên bản: v1

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| ID | UC-06 (điều chỉnh theo naming convention của nhóm nếu cần) |
| Tên | Create Order (Tạo đơn hàng) |
| Actor chính | Khách hàng |
| Actor phụ | Hệ thống Backend (NestJS), cơ sở dữ liệu (CSDL) |
| Mô tả | Khách hàng gửi thông tin giỏ hàng để tạo đơn hàng mới. Hệ thống kiểm tra dữ liệu, sản phẩm, topping và tồn kho; tính tổng tiền ở phía server và tạo đơn hàng ở trạng thái `PENDING` nếu yêu cầu hợp lệ. |
| Phạm vi | Từ lúc khách hàng yêu cầu đặt hàng đến khi hệ thống trả về kết quả tạo đơn và mã đơn hàng. Thanh toán thuộc phạm vi của feature Payment. |
| Trigger | Khách hàng nhấn “Đặt hàng” trên giao diện giỏ hàng. |

## 2. Pre-condition

1. Khách hàng đã đăng nhập vào hệ thống BrewLite và có Bearer JWT token hợp lệ trong header `Authorization`.
2. Request chứa ít nhất một phần tử trong `items`; mỗi phần tử có `productId`, `quantity` và các trường tùy chọn phù hợp như `size`, `toppingIds`.
3. Sản phẩm được yêu cầu tồn tại, đang khả dụng (`isAvailable = true`) và có đủ tồn kho (`stock >= quantity`).
4. Các topping được yêu cầu (nếu có) phải tồn tại, đang khả dụng và đáp ứng điều kiện tồn kho.
5. Dữ liệu đầu vào đáp ứng các quy tắc validation của backend (`CreateOrderDto`).

## 3. Post-condition

**Thành công:**

- Có bản ghi `Order` ở trạng thái `PENDING` và các bản ghi `OrderItem` tương ứng.
- Backend tự tính và lưu các giá trị tiền theo quy tắc nghiệp vụ, gồm `totalAmount`, `discountAmount` và `finalAmount`.
- Tồn kho sản phẩm và topping được cập nhật trong transaction theo số lượng đã đặt.
- Hệ thống trả về thông tin đơn hàng, bao gồm `id` và các dữ liệu liên quan trong response.
- Frontend có thể sử dụng thông tin đơn hàng để chuyển sang bước tiếp theo của quy trình đặt hàng.

**Thất bại:**

- Request bị từ chối hoặc xử lý thất bại; không tạo đơn hàng thành công.
- Nếu transaction thất bại, các cập nhật dữ liệu và tồn kho trong transaction được rollback.
- Tồn kho không bị trừ dở dang khi quá trình tạo đơn thất bại.
- Giỏ hàng trên frontend được giữ nguyên nếu frontend không chủ động xóa hoặc cập nhật giỏ hàng.

## 4. Main flow

| Bước | Tác nhân | Hành động |
|---|---|---|
| 1 | Khách hàng | Bấm “Đặt hàng” trên giao diện giỏ hàng. |
| 2 | Frontend | Gửi request `POST /api/v1/orders` kèm header `Authorization: Bearer <JWT>` và body `{ items: [{ productId, size, quantity, toppingIds }] }`. |
| 3 | Backend | Tiếp nhận request, `JwtAuthGuard` xác thực token và trích xuất `userId = req.user.sub`; `ValidationPipe` kiểm tra dữ liệu đầu vào theo DTO. |
| 4 | Backend | Kiểm tra thông tin người dùng, sản phẩm, topping và số lượng tồn kho theo yêu cầu đặt hàng. |
| 5 | Backend | Tính giá phía server, bao gồm giá sản phẩm theo kích cỡ và giá topping; tính `lineTotal` cùng các giá trị tiền của đơn hàng. |
| 6 | Backend | Mở transaction, cập nhật tồn kho sản phẩm và topping bằng các thao tác kiểm tra điều kiện tồn kho trước khi trừ số lượng. |
| 7 | Backend | Tạo bản ghi `Order` ở trạng thái `PENDING`, các bản ghi `OrderItem`, `OrderItemTopping` và lịch sử trạng thái ban đầu (`fromStatus: null, toStatus: PENDING`). |
| 8 | Cơ sở dữ liệu | Commit transaction nếu các thao tác thành công; rollback các thay đổi thuộc transaction nếu có lỗi. |
| 9 | Backend | Trả response `201 Created` chứa thông tin đơn hàng bọc qua `TransformInterceptor` (`id`, `orderNumber`, `status: PENDING`, `totalAmount`, `discountAmount`, `finalAmount`). |
| 10 | Frontend | Nhận kết quả tạo đơn (`201 Created`), lưu `pendingOrderId` vào Zustand store, KHÔNG xóa giỏ hàng lúc này (D2), và chuyển sang màn hình thanh toán. Chỉ gọi `clearCart()` khi thanh toán `SUCCESS` (đơn đạt `PAID`). |

## 5. Alternative / Error flow

| Mã | Tại bước | Điều kiện | Xử lý | Kết quả |
|---|---|---|---|---|
| 3a | 3 | Chưa đăng nhập, JWT sai hoặc hết hạn | Trả `401 Unauthorized` | Frontend thông báo phiên hết hạn và điều hướng tới trang đăng nhập; giỏ hàng được giữ nguyên |
| 4a | 4 | Dữ liệu đầu vào không hợp lệ, thiếu trường bắt buộc, `quantity < 1` hoặc `size` không hợp lệ | Từ chối request; trả `400 Bad Request` kèm thông báo validation | Không tạo đơn hàng thành công |
| 4b | 4 | Sản phẩm không tồn tại hoặc không khả dụng | Từ chối request; trả `400 Bad Request` (hoặc `404 Not Found`) | Không tạo đơn hàng thành công; frontend thông báo để khách hàng kiểm tra lại giỏ |
| 4c | 4 | Topping không tồn tại hoặc không hợp lệ | Từ chối request; trả `400 Bad Request` | Không tạo đơn hàng thành công |
| 5a | 5 | Lỗi khi tính giá hoặc dữ liệu giá không hợp lệ | Từ chối request theo quy tắc xử lý lỗi thực tế | Không tạo đơn hàng với giá không hợp lệ |
| 6a | 6 | Tồn kho không đủ, hoặc cập nhật tồn kho có điều kiện thất bại | Backend phát sinh lỗi và transaction được rollback; trả `400 Bad Request` | Không tạo đơn thành công; tồn kho không bị trừ dở dang |
| 6b | 6 | Nhiều request cùng đặt sản phẩm có tồn kho giới hạn | Cập nhật tồn kho có điều kiện bảo đảm tính nguyên tử (Optimistic Lock); request không đủ hàng thất bại | Không bán vượt số lượng tồn kho; trả `400 Bad Request` |
| 7a | 7 | Lỗi cơ sở dữ liệu khi tạo đơn hoặc chi tiết đơn | Transaction rollback nếu lỗi xảy ra trong transaction | Không để lại dữ liệu đơn hàng hoặc thay đổi tồn kho dở dang |

### Ghi chú

- Các mã HTTP tuân theo quy ước chung của `AllExceptionsFilter`.
- Giỏ hàng trên frontend được giữ nguyên khi tạo đơn hoặc khi thanh toán lỗi; chỉ làm rỗng khi đơn hàng được thanh toán thành công (`PAID`).

## 6. Business rules

| ID | Quy tắc |
|---|---|
| BR-01 | Giá đơn hàng do **server tính toán** dựa trên dữ liệu và quy tắc giá ở backend; không tin tưởng giá do client gửi lên. |
| BR-02 | Đơn hàng mới tạo có trạng thái `PENDING`; client không được tự chọn trạng thái khi tạo đơn. |
| BR-03 | **Xác thực JWT (D4):** Request tạo đơn bắt buộc có Bearer JWT. `userId` được trích xuất từ `req.user.sub`; `CreateOrderDto` tuyệt đối KHÔNG nhận `userId` từ client body nhằm bảo vệ toàn vẹn danh tính. |
| BR-04 | Tồn kho sản phẩm (Optimistic Lock) và topping (conditional update) được cập nhật trong transaction cùng quá trình tạo đơn; nếu transaction thất bại, mọi thao tác đều được rollback. |
| BR-05 | **Quy tắc hủy đơn & Hạn thanh toán (D6):** Khách hàng chủ động hủy đơn qua `POST /orders/:id/cancel` (chỉ từ `PENDING` hoặc `PAYMENT_FAILED` sang `CANCELLED`, hoàn tồn kho trong transaction). MVP không cài đặt scheduler tự động hủy 15 phút. Đơn bỏ dở sẽ giữ tồn kho cho đến khi hủy thủ công (Known Limitation). |
| BR-06 | **Khuyến mãi (D7):** `POST /orders` nhận thêm `promotionCode?: string`. Backend gọi `PromotionsService.validate(code, totalAmount)` để tính `discountAmount` và `finalAmount`. Mỗi đơn áp dụng tối đa 1 mã. |
| BR-07 | Các chuyển đổi trạng thái đơn hàng phải tuân theo State Machine đã thống nhất (9 chuyển tiếp giữa các trạng thái + 1 bước khởi tạo). Sử dụng hàm `assertTransition` để chặn các chuyển đổi trái phép. |
| BR-08 | Một đơn hàng phải có ít nhất một phần tử trong `items`; mỗi `quantity` phải là số nguyên từ `1` đến `99` (D5); mỗi món chọn tối đa 3 loại topping không trùng lặp (`@ArrayMaxSize(3)`, `@ArrayUnique()`). |

## 7. Acceptance criteria

| ID | Given / When / Then |
|---|---|
| AC-01 | **Given:** Header chứa Bearer JWT hợp lệ (`req.user.sub`), `items` có ít nhất một sản phẩm hợp lệ và đủ tồn kho (DTO không có `userId`). **When:** Gửi request tạo đơn. **Then:** Trả `201 Created`, đơn có trạng thái `PENDING`, các giá trị tiền được backend tính toán và response chứa mã đơn hàng. |
| AC-02 | **Given:** Request không có Bearer JWT hoặc token hết hạn/không hợp lệ. **When:** Gửi request tạo đơn. **Then:** Request bị từ chối với mã lỗi `401 Unauthorized`. |
| AC-03 | **Given:** `quantity = 0`, `quantity > 99`, `quantity` không phải số nguyên hoặc `size` không hợp lệ. **When:** Gửi request tạo đơn. **Then:** Trả lỗi validation `400 Bad Request` và không tạo đơn thành công. |
| AC-04 | **Given:** Request chứa topping không tồn tại hoặc không hợp lệ. **When:** Gửi request tạo đơn. **Then:** Request bị từ chối `400 Bad Request` và không tạo đơn thành công. |
| AC-05 | **Given:** Một sản phẩm không đủ tồn kho. **When:** Gửi request đặt hàng với số lượng vượt tồn kho. **Then:** Request thất bại với mã lỗi `400 Bad Request`, không tạo đơn thành công và tồn kho không bị trừ dở dang. |
| AC-06 | **Given:** Tồn kho sản phẩm bằng `5`, có `10` request đồng thời, mỗi request đặt `quantity = 1`. **When:** Các request được xử lý với Optimistic Locking. **Then:** Đúng `5` request thành công, các request còn lại nhận `400 Bad Request`, tồn kho cuối cùng không âm và không bán vượt số lượng có sẵn. |
| AC-07 | **Given:** Lỗi xảy ra trong transaction khi tạo đơn. **When:** Backend xử lý request. **Then:** Transaction được rollback; không để lại đơn hàng hoặc thay đổi tồn kho dở dang. |
| AC-08 | **Given:** Yêu cầu tạo đơn thành công. **When:** Backend trả kết quả. **Then:** Response chứa các trường tiền `totalAmount`, `discountAmount` và `finalAmount`; giá trị phải được tính ở phía server. |

## 8. Liên kết với Activity và State Machine

| Luồng | Trạng thái đơn / Kết quả |
|---|---|
| Main flow bước 7–9: tạo đơn thành công | Tạo đơn mới ở trạng thái `PENDING`; transaction được commit và backend trả kết quả tạo đơn |
| Error flow 3a, 4a, 4b, 4c, 5a, 6a, 6b, 7a | Request thất bại; không tạo đơn thành công. Rollback toàn bộ transaction |
| Thanh toán thành công (feature Payment) | `PENDING → PAID`, gọi `OrderService.transition(orderId, PAID)`, tích điểm loyalty (D1, D9) |
| Thanh toán thất bại | `PENDING → PAYMENT_FAILED`, gọi `OrderService.transition(orderId, PAYMENT_FAILED)` (D1) |
| Thử lại sau thanh toán thất bại | `PAYMENT_FAILED → PENDING`, gọi `OrderService.transition(orderId, PENDING)`, thanh toán với Idempotency-Key mới (D1) |
| Khách hủy đơn | Gọi `POST /orders/:id/cancel` chuyển từ `PENDING` hoặc `PAYMENT_FAILED` sang `CANCELLED`, hoàn tồn kho (D6) |
| Hủy đơn đã thanh toán | `PAID → CANCELLED`: chỉ có trong State Machine/Service (chuẩn PDF), ngoài phạm vi MVP (D6) |

### Tài liệu liên quan

- `activity-order.puml` (Sơ đồ Activity PlantUML)
- `usecase-order.puml` (Sơ đồ Use Case PlantUML)
- `activity.md` (Đặc tả Activity flow)
- `state-machine.md` (Đặc tả Order State Machine)
- `api-contract.md` (Hợp đồng API)
- `db-mapping-order.md` (Mapping cơ sở dữ liệu)
- `fe-be-skeleton.md` (Bộ khung mã nguồn FE & BE mẫu)
- `test-cases.md` (Bộ kịch bản test case)

## 9. Thống nhất liên feature — Đã chốt theo quyết định D1–D9

| Với | Nội dung đã chốt | Trạng thái |
|---|---|---|
| Gia Kiệt (Payment) | Thanh toán lỗi chuyển `PAYMENT_FAILED`; thử lại chuyển `PAYMENT_FAILED → PENDING`. `OrderService.transition` là nơi duy nhất cập nhật status. | Đã chốt (D1) |
| Hoàng Huy (Product Detail) | Công thức: `lineTotal = (unitPrice + Σ toppingPrice) × quantity`. Server tính giá cuối cùng. | Đã chốt (D3) |
| Tuấn Hào (Cart) | Request `POST /orders` gồm `items[{productId, size, quantity, toppingIds}]` và `promotionCode?: string`. Không xóa giỏ khi tạo đơn; chỉ xóa khi PAID. | Đã chốt (D2, D7) |
| Quang Huy (History) | `POST /orders/:id/cancel` cho phép hủy đơn `PENDING`/`PAYMENT_FAILED`. `GET /orders/me` trích xuất `userId` từ JWT token. | Đã chốt (D4, D6) |

## 10. Điểm cần xử lý (Open Item)

- **Lệch schema tại `OrderStatusHistory.fromStatus`:**
  - Trong `schema.prisma`, trường `fromStatus OrderStatus` là bắt buộc (không nullable).
  - Tuy nhiên, khi tạo đơn hàng mới (`(start) → PENDING`), trạng thái ban đầu chưa có trạng thái trước (`fromStatus: null`).
  - **Đề xuất giải pháp:** Giữ nguyên schema hiện tại trong tài liệu này; Backend Owner sẽ tạo một migration riêng để sửa trường này thành nullable (`fromStatus OrderStatus?`). Không sửa schema trong nhánh tài liệu.

## 11. Lịch sử thay đổi
- v1.0 (2026-10-09): Khởi tạo đặc tả Use Case Order.
- v1.1 – áp dụng quyết định D1, D2, D4, D5, D6, D7 (ngày 2026-10-16).

