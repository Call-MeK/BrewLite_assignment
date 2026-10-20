# Chạy Payment với ZaloPay sandbox

Code dùng **API v2**, khớp `ZALOPAY_ENDPOINT` trong `backend/.env` bạn cung cấp. Link v1 ban đầu dùng tên trường/endpoint khác; không trộn hai phiên bản. Tài liệu nguồn: [API v2](https://developers.zalopay.vn/v2/general/overview.html), [mã kết quả](https://docs.zalopay.vn/vi/docs/developer-tools/knowledge-base/status-codes/).

## 1. Cấu hình backend

Giữ AppId, Key1, Key2 đã điền trong `backend/.env`; kiểm tra các biến sau:

```dotenv
ZALOPAY_APP_ID=<AppId sandbox của bạn>
ZALOPAY_KEY1=<khóa ký yêu cầu>
ZALOPAY_KEY2=<khóa xác thực callback>
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
ZALOPAY_REDIRECT_URL=http://localhost:3000/payments
ZALOPAY_CALLBACK_URL=https://<backend-public>/api/v1/payments/zalopay/callback
```

`ZALOPAY_REDIRECT_URL` là URL gốc của màn hình thanh toán. Backend tự nối `/orderId` khi tạo link. Khi deploy frontend, thay localhost bằng URL HTTPS frontend của bạn. `ZALOPAY_CALLBACK_URL` có thể bỏ trống nếu app đã đăng ký callback trong merchant portal.

Không cần cấu hình MAC cố định: backend tự ký từng yêu cầu bằng Key1. Không đưa Key1/Key2 vào frontend hoặc commit `.env`.

## 2. Khởi chạy

1. Bật Docker Desktop. Từ thư mục gốc chạy `docker compose up -d postgres`. Nếu đã có container BrewLite bị dừng và Compose báo trùng tên, chạy `docker start brewlite_postgres`, không xóa container/volume.
2. Trong `backend/`:

   ```powershell
   npm.cmd install
   npm.cmd run prisma:generate
   npx.cmd prisma migrate deploy
   npm.cmd run start:dev
   ```

3. Trong `frontend/`:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

Backend đọc `backend/.env` khi chạy từ thư mục backend. Frontend dùng `http://localhost:4000/api/v1` mặc định; nếu đổi địa chỉ, tạo `frontend/.env.local` với `NEXT_PUBLIC_API_URL` tương ứng.

## 3. Kiểm tra riêng module khi Auth và tạo Order chưa hoàn thành

Repo hiện chưa có endpoint đăng nhập/tạo đơn. Payment đã có JWT guard, không bỏ qua xác thực. Cần User và Order PENDING do module Order tạo, hoặc fixture phát triển riêng. Không chạy seed hiện tại trên database có dữ liệu cần giữ vì seed có thao tác xóa dữ liệu.

Cách tạo fixture an toàn trong môi trường local: chạy lệnh dưới đây từ `backend/`. Lệnh tạo mới một tài khoản thử nghiệm với mật khẩu không dùng để đăng nhập và một đơn 10.000đ không có OrderItem; không sửa dữ liệu cũ hoặc tồn kho. Chỉ dùng fixture này để thử module Payment, không dùng làm đơn bán hàng thật.

```powershell
@'
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const p = new PrismaClient();
(async () => {
  const u = await p.user.create({ data: {
    email: 'payment-' + randomUUID() + '@example.invalid',
    passwordHash: 'development-fixture-disabled-login',
  } });
  const o = await p.order.create({ data: { userId: u.id, totalAmount: 10000, finalAmount: 10000 } });
  console.log(JSON.stringify({ userId: u.id, orderId: o.id }));
})().finally(() => p.$disconnect());
'@ | node -r dotenv/config
```

Ghi lại `userId` và `orderId`. Để lấy JWT của fixture, chạy từ `backend/`, thay `USER_ID`:

```powershell
node -r dotenv/config -e "const { JwtService } = require('@nestjs/jwt'); console.log(new JwtService().sign({ sub: 'USER_ID' }, { secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: '1h' }));"
```

Token này chỉ dùng local, không commit/chia sẻ. Trong DevTools của frontend localhost:3000, lưu bằng `localStorage.setItem('token', '<JWT của fixture>')`, rồi mở `http://localhost:3000/payments/<orderId>`. Khi module Auth hoàn thành, dùng token do đăng nhập trả về và bỏ bước fixture này.

## 4. Callback HTTPS

1. Chuẩn bị URL HTTPS công khai tới backend cổng 4000 (hosting hoặc tunnel bạn quản lý).
2. Điền `ZALOPAY_CALLBACK_URL=https://<backend-public>/api/v1/payments/zalopay/callback`, hoặc cấu hình URL này làm callback của app trong [sandbox merchant portal](https://sbmc.zalopay.vn/).
3. Restart backend sau khi đổi `.env`. Xác nhận endpoint công khai không bị trang đăng nhập/proxy chặn; callback không dùng Bearer JWT, dùng chữ ký Key2.
4. Chọn ví hoặc thẻ trên màn hình thanh toán, thực hiện bằng tài khoản/thẻ test ZaloPay cấp.
5. Sau thanh toán, frontend kiểm tra kết quả từ backend. Callback hợp lệ hoặc truy vấn đã xác nhận thành công mới chuyển Order PAID và cộng điểm.

Nếu chưa có HTTPS/callback, có thể thử tạo link; nút “Kiểm tra kết quả” dùng API query để lấy kết quả khi thiếu callback. Cung cấp cho người hỗ trợ **URL public và xác nhận đã cấu hình**, không gửi các khóa.

## 5. API và cách xử lý lỗi

| API | Công dụng |
| --- | --- |
| `POST /api/v1/payments` | Body `{ orderId, method }`, JWT và `Idempotency-Key`; trả Payment cùng paymentUrl |
| `GET /api/v1/payments/orders/:orderId` | JWT; lấy tiền từ Order và lần thanh toán mới nhất |
| `GET /api/v1/payments/:id` | JWT; đối chiếu ZaloPay cho giao dịch PENDING |
| `POST /api/v1/payments/zalopay/callback` | JSON `{ data, mac, type: 1 }`; trả trực tiếp `{ return_code, return_message }` |

- Tạo link thành công vẫn là PENDING; chưa có nghĩa đã thu tiền.
- Khi timeout/mất mạng: kiểm tra giao dịch hiện tại, không tạo key mới để thu tiền tiếp. Callback đến chậm vẫn có thể hoàn tất đơn.
- Cùng key/cùng payload trả lại kết quả; cùng key/khác payload trả 409. Khác key nhưng đơn đang có giao dịch PENDING cũng trả 409.
- Có thể thử lại bằng key mới sau khi gateway xác nhận thất bại/hết hạn. Sai cấu hình/chữ ký hoặc lỗi không rõ khi query giữ PENDING để tránh thu tiền hai lần.
- Giỏ hàng chỉ xóa khi SUCCESS và `pendingOrderId` khớp Order vừa thanh toán. Cart store chưa có trong repo; integration hiện dùng đúng cấu trúc localStorage được mô tả trong `docs/cart/fe-be-skeleton.md`.
- Không có cron đối soát nền/hoàn tiền; giao dịch lâu không rõ hoặc callback tới sau khi đã kết thúc cần đối soát thủ công.

## 6. Kiểm thử

Trong `backend/`: `node --require ts-node/register --test test/*.test.cjs`. Integration test tạo schema `payment_test_<uuid>` riêng, chạy migration rồi xóa đúng schema đó; không xóa bảng public. Cần DATABASE_URL kết nối được PostgreSQL và tài khoản có quyền tạo schema. Các test tự động dùng fake HTTP/gateway; không gọi thu tiền thật.

Build: `npm.cmd run build` trong cả backend và frontend. Để nghiệm thu sandbox thực tế cần thực hiện một lần thanh toán bằng app/thẻ test và kiểm tra callback; build/test tự động không thay thế bước này.
