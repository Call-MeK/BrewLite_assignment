# Payment v1.2: chạy và kiểm tra

Payment chỉ dùng mock nội bộ, không kết nối gateway, không QR/webhook/refund/scheduler. Giữ schema hiện tại, không cần migration.

## Cấu hình

Trong `backend/.env`, giữ `DATABASE_URL` và `JWT_SECRET` hợp lệ, thêm:

```dotenv
NODE_ENV=development
PAYMENT_DEMO_MODE=true
```

Chạy từ `backend/`:

```powershell
npm.cmd run prisma:generate
npm.cmd run start:dev
```

Mock mặc định SUCCESS khi không gửi `X-Mock-Outcome`. Chỉ hoạt động với development/test và demo bật; mọi cấu hình khác trả 503 kể cả production. Không đổi `.env.example` thành cấu hình production cho thanh toán thật.

## Dependency và phạm vi tích hợp

Auth và Order hiện chỉ có health endpoint. Đã bổ sung JWT guard thật (HS256, kiểm tra chữ ký, thời hạn, `sub`) và `OrdersService.transition()` thật (conditional update theo status/version, lịch sử, paidAt, loyalty trong transaction). Không triển khai đăng nhập, tạo/hủy đơn hay hoàn kho; không thêm endpoint ngoài Payment. Các endpoint đó vẫn thuộc phạm vi module tương ứng.

Payment khóa dòng Order trong PostgreSQL để tuần tự hóa các lượt thử. Mọi thay đổi status đi qua Order service. Thành công cộng `floor(finalAmount / 1000)` điểm đúng một lần. Thất bại giữ tồn kho. Retry dùng key mới và backend tự chuyển PAYMENT_FAILED → PENDING. Nếu lỗi ở bất kỳ bước ghi dữ liệu nào, toàn bộ lượt thử rollback; client có thể gửi lại cùng key.

Request hash gồm userId, orderId, method và outcome demo đã chuẩn hóa. Cùng key khác nội dung trả 409. PENDING trả 409 rõ trạng thái đang xử lý; không có cơ chế phục hồi Payment PENDING từ dữ liệu cũ trong v1.2. Các lượt mock mới hoàn tất đồng bộ trong cùng transaction nên không để lại PENDING khi tiến trình hoặc transaction lỗi.

`TransformInterceptor` chỉ thay thời điểm đọc statusCode để khớp HTTP 200 của replay/FAILED và 201 của SUCCESS mới. Response vẫn dùng interceptor và exception filter chung.

## Postman

1. Dùng User và Order PENDING đã có trong database. Nếu chưa có, mở `npx.cmd prisma studio` để tạo dữ liệu demo: User có email/passwordHash; Order có userId tương ứng, totalAmount/finalAmount (ví dụ 65999), status=PENDING. Không dùng thao tác tạo fixture này cho dữ liệu vận hành.
2. Vì chưa có API login, tạo JWT demo từ secret của backend. Trong PowerShell tại `backend/`, thay `USER_ID` bằng chủ đơn và chạy:

```powershell
@'
require('dotenv').config({ quiet: true });
const { JwtService } = require('@nestjs/jwt');
if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET');
console.log(new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: 'USER_ID' }, { expiresIn: '1h' }));
'@ | node -
```

3. Gửi `POST http://localhost:4000/api/v1/payments`:

```http
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: demo-order-attempt-1
X-Mock-Outcome: FAILED
```

```json
{ "orderId": "ORDER_ID", "method": "E_WALLET" }
```

4. Nhận HTTP 200, `data.status=FAILED`; Order thành PAYMENT_FAILED, không cộng điểm. Đổi key thành `demo-order-attempt-2` và outcome thành SUCCESS: nhận HTTP 201, Order PAID, paidAt có giá trị, cộng 65 điểm nếu finalAmount=65999.
5. Gửi lại y nguyên request SUCCESS: HTTP 200, cùng Payment ID, không cộng thêm điểm. Giữ key và đổi method/outcome: 409. Đổi key sau khi PAID: 409. Dùng token người khác: 403. Cả BANK_CARD và E_WALLET đều được chấp nhận; body không nhận amount/userId.

Health giữ tại `GET /api/v1/payments/health` và không yêu cầu JWT.

## Kiểm thử

```powershell
npx.cmd prisma validate
npm.cmd run build
# Có thể bỏ biến này nếu DATABASE_URL hiện tại đã trỏ PostgreSQL test có quyền tạo schema.
$env:PAYMENT_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/TEST_DATABASE'
npm.cmd run test:payment
npm.cmd test
```

Test dùng Node test runner, Nest HTTP và PostgreSQL thật; mỗi lượt tạo schema `payment_test_<uuid>` bằng `prisma db push --skip-generate`, rồi xóa đúng schema đó. Không reset database/schema ứng dụng. Không dùng fake Auth/Order trong production. Kiểm tra SUCCESS/FAILED, retry, replay, xung đột request, cạnh tranh cùng/khác key và khác người dùng, quyền sở hữu, JWT/DTO, rollback, production và loyalty.

Kết quả chạy ngày 2026-10-21: Prisma validation PASS; Nest build PASS; frontend Next.js build PASS; Payment 17/17 PASS; toàn bộ backend 20/20 PASS; `git diff --check` PASS. Test chạy bằng PostgreSQL 18 tạm tại localhost:55432 vì database trong `.env` ở cổng 5433 không phản hồi. Chưa chạy Postman thủ công hoặc luồng đăng nhập → tạo đơn → thanh toán vì hai API đầu chưa được triển khai; HTTP integration test đã dùng JWT ký hợp lệ và dữ liệu Order thật.
