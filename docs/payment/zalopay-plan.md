# ZaloPay v2 Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans and test-driven-development.

**Goal:** Thanh toán ZaloPay sandbox v2 an toàn, có giao diện và hướng dẫn cấu hình.
**Architecture:** ZaloPay service phụ trách HTTP/HMAC; PaymentsService quản lý các lần thanh toán và giao dịch database; PaymentOrderService giữ transition và loyalty. Frontend dùng fetchApi hiện có.
**Tech Stack:** NestJS, Prisma/PostgreSQL, node:crypto/fetch/node:test, Next.js/React.
**Spec:** `docs/payment/zalopay-design.md`.

## Global Constraints

- Dùng đúng giao thức v2; không thêm dependency, không hardcode secret.
- Không gọi mạng trong transaction database; timeout giữ PENDING.
- Chỉ chủ đơn được thao tác; callback xác thực bằng Key2.
- Không làm toàn bộ module Auth, Cart, tạo Order hoặc VNPay.

## Review Focus

- Đồng thời khác key trên cùng đơn: không tạo hai giao dịch ngoài cổng.
- Callback đến trước phản hồi create: không ghi đè SUCCESS.
- Số tiền, app_id hoặc transaction reference sai: không cập nhật đơn.
- Timeout hoặc mã kết quả chưa rõ: không cho thu tiền lần nữa.
- Giỏ khác đơn đang thanh toán: không xóa nhầm dữ liệu.

## Task 1: Giao thức ZaloPay và xác thực

Files: `backend/src/modules/payments/zalopay.service.ts`, DTO, `backend/src/modules/payments/payment-auth.guard.ts`, PaymentsModule, `backend/test/zalopay.test.cjs`.
Interfaces: ZaloPay `create(payment,userId)`, `query(gatewayOrderId)`, `verifyCallback(data,mac)`; guard gắn req.user.sub.

- [x] Viết test ký create/query theo v2, cấu hình thiếu, HTTP timeout, callback sai chữ ký/app_id và JWT thiếu/hết hạn.
- [x] Chạy test bằng `node --require ts-node/register --test test/zalopay.test.cjs`, xác nhận thất bại trước khi thêm implementation.
- [x] Implement bằng node:crypto và fetch, v2 sandbox endpoints, so sánh MAC constant time.
- [x] Chạy lại test, phải không có fail.

## Task 2: Payment persistence, idempotency và transition

Files: model Payment trong Prisma schema/migration; Payment module/controller/service; PaymentOrderService trong payments; `backend/test/payments.test.cjs`.
Interfaces: `create(userId,dto,key)`, `get(userId,id)`, `getOrder(userId,id)`, `callback(dto)`; Order `transition(tx,order,to)`.

- [x] Viết integration test dùng schema PostgreSQL tạm cho quyền sở hữu, amount, duplicate/concurrent keys, retry, callback lặp, rollback loyalty, timeout và callback đến sớm.
- [x] Chạy test để thấy các hành vi chưa được implement.
- [x] Thêm hai cột/index của Payment, transaction khóa hàng Order, JWT/DTO trong Payment; POST Payment tự trả envelope 200/201 và callback trả JSON v2 trực tiếp, giữ nguyên interceptor chung.
- [x] Chạy test và build backend; migration không xóa/sửa dữ liệu hiện có.

## Task 3: Giao diện và hướng dẫn

Files: `frontend/src/app/payments/[orderId]/page.tsx`, component PaymentCheckout, `frontend/src/lib/payments.ts`, hướng dẫn cấu hình trong docs/payment, API contract/test-cases.
Interfaces: frontend `Payment`, `PaymentOrder`, `createPayment`, `getPayment`, `getPaymentOrder`, `clearPaidCart(storage,orderId)`.

- [x] Test frontend helper giữ giỏ khi lỗi/khác đơn, xóa sau thành công, giữ key khi chưa rõ kết quả.
- [x] Trang thanh toán lấy số tiền server, loading/error/success/pending/retry, mở paymentUrl và kiểm tra kết quả; không tin query redirect.
- [x] Hướng dẫn cấu hình AppId/Key1/Key2, portal callback URL v2, migration và cách chạy/test với Order/JWT từ module phụ thuộc.
- [x] Chạy toàn bộ node tests, Prisma validate, backend/frontend build và git diff --check; ghi rõ phần sandbox thật chưa thể kiểm tra về callback/app sandbox thực tế.

## Ledger

- Ruling: triển khai trực tiếp theo yêu cầu mới “dựa vào đó dev giúp tôi”; chuyển từ Mock sang ZaloPay v2 và không yêu cầu xác nhận lại công việc đã giao.
- Ruling: làm trên nhánh feature hiện có; giữ file hướng dẫn đã tạo ở lượt trước, không tạo worktree mới.
- Ruling: endpoint người dùng điền là v2/create nên dùng v2 và cập nhật đặc tả thay vì trộn giao thức v1/v2.
- Task 1 complete: ký create/query, xác thực callback/JWT và kiểm tra thiếu cấu hình đã qua test. Live sandbox create được chấp nhận; query trả return_code=3, is_processing=true. Không thực hiện thanh toán.
- Task 2 complete: migration hai cột đã áp dụng; kiểm thử PostgreSQL trong schema tạm xác nhận idempotency, cạnh tranh key, callback/query đồng thời, rollback, quyền sở hữu và loyalty. Database public giữ nguyên dữ liệu.
- Task 3 complete: giao diện /payments/[orderId], helper bảo toàn giỏ và hướng dẫn cấu hình đã thêm. Backend/frontend build thành công; Prisma validate hợp lệ; toàn bộ 31 test qua; git diff --check sạch.
- Review fixes: đưa callback URL validation trước khi tạo Payment; sửa redirect trong hướng dẫn cũ; thêm test đồng thời callback/query và các biên -101, -54, lỗi chữ ký/hệ thống.
- Chưa kiểm tra: browser UI tương tác và thanh toán qua app/thẻ/callback HTTPS thật. Các module đăng nhập/tạo đơn chưa được triển khai, hướng dẫn cung cấp fixture local không xóa dữ liệu.
- Scope update: theo yêu cầu chỉ sửa Payment, đã trả AuthModule, OrdersModule, TransformInterceptor, backend/package.json, README và .env.example gốc về nguyên trạng. PaymentAuthGuard/PaymentOrderService chỉ đăng ký trong PaymentsModule. Giữ model/migration Payment, giao diện và test/tài liệu Payment; không chỉnh các module khác. Sau điều chỉnh: 31/31 test PASS, backend build PASS, health và POST callback local PASS.
