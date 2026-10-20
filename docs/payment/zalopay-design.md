# Thiết kế Payment ZaloPay sandbox v2

Yêu cầu cập nhật: dùng ZaloPay sandbox thay Mock của MVP. Người dùng gửi tài liệu v1, nhưng endpoint trong backend/.env là v2/create, vì vậy code dùng v2 khớp cấu hình đã cung cấp. Triển khai trực tiếp trên nhánh `feat/payment`, không thêm dependency và không triển khai VNPay/hoàn tiền.

Ràng buộc phạm vi: không sửa code Auth, Orders, interceptor/filter hay API client dùng chung. PaymentAuthGuard và PaymentOrderService nằm trong thư mục payments và chỉ đăng ký ở PaymentsModule. POST Payment tự trả envelope chuẩn để hỗ trợ HTTP 200/201 mà không đổi interceptor. Chỉ giữ thay đổi database ở model Payment, test/tài liệu/giao diện Payment và biến cấu hình ZaloPay.

## Phạm vi và giao diện

- `POST /api/v1/payments`: JWT, DTO `{ orderId, method }`, header `Idempotency-Key`; lấy `Order.finalAmount`, lưu lần thanh toán trước khi gọi ZaloPay; trả Payment và `paymentUrl`. Lần mới HTTP 201, lặp lại HTTP 200.
- `GET /api/v1/payments/orders/:orderId`: JWT, kiểm tra chủ đơn, trả số tiền/trạng thái đơn và lần thanh toán gần nhất cho màn hình thanh toán.
- `GET /api/v1/payments/:id`: JWT, kiểm tra chủ đơn; truy vấn ZaloPay khi còn PENDING, cập nhật kết quả đã xác nhận.
- `POST /api/v1/payments/zalopay/callback`: không dùng JWT, xác thực HMAC-SHA256 bằng Key2 trên nguyên chuỗi `data`; kiểm tra app_id, app_trans_id, amount, zp_trans_id, type=1. Trả JSON v2 `{ return_code, return_message }` trực tiếp, không bọc envelope ứng dụng.
- Trang `/payments/[orderId]`: lấy số tiền từ backend, chọn ví/thẻ, mở link ZaloPay, kiểm tra kết quả khi trở về và bằng nút bấm. Chỉ xóa giỏ localStorage theo hợp đồng `brewlite_cart_storage` khi SUCCESS và pendingOrderId khớp đơn vừa thanh toán. Không triển khai toàn bộ Cart/Auth/Order creation chưa có trong repo.

## Tích hợp và dữ liệu

API v2 dùng `app_id`, `app_trans_id`, `app_user`, `app_time`, `embed_data`, `bank_code`; create/query gửi form URL encoded tới https://sb-openapi.zalopay.vn/v2/create và /v2/query. Backend sinh MAC mới bằng Key1, không dùng MAC cố định. Mã giao dịch dài tối đa 40 ký tự, tiền tố ngày Việt Nam `yyMMdd_`. Dùng cấu hình người dùng `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT`, `ZALOPAY_REDIRECT_URL`; callback URL đăng ký trong portal hoặc truyền `ZALOPAY_CALLBACK_URL`. Không hardcode khóa ví dụ hoặc tự chuyển sang Mock khi thiếu cấu hình.

Thêm `Payment.gatewayOrderId` unique và `Payment.paymentUrl` nullable, migration chỉ thêm cột/index. `transactionRef` lưu zp_trans_id sau xác nhận. Giữ schema/trạng thái Order hiện có. JWT guard dùng thư viện JWT đã cài; PaymentOrderService chỉ cung cấp transition phục vụ thanh toán, ghi lịch sử và tích điểm floor(finalAmount/1000) trong cùng transaction.

## Bất biến và lỗi

- Khóa hàng Order trong transaction trước kiểm tra/tạo lần thanh toán để chỉ có một Payment PENDING cho một đơn, kể cả các key khác nhau. Không giữ transaction khi gọi HTTP bên ngoài.
- Kiểm tra idempotency theo cả chủ đơn và hash của orderId/method; key trùng khác payload trả 409; không gọi lại create với cùng key. Lặp lại sau PAID vẫn trả kết quả đã lưu.
- Callback/truy vấn dùng khóa hàng và cập nhật có điều kiện, Payment SUCCESS + Order PAID + lịch sử + loyalty commit cùng nhau. Callback lặp không cộng điểm lại.
- Timeout/network/lỗi phản hồi không rõ giữ PENDING; không tạo lần thu tiền mới. Query return_code=1 và is_processing=false mới xác nhận thành công. return_code=2 chỉ kết luận hết hạn khi sub_return_code=-54 hoặc -101 sau 15 phút và trong cửa sổ an toàn 48 giờ; lỗi cấu hình/chữ ký/mã lạ hoặc is_processing=true vẫn giữ PENDING. Create trả lỗi trùng app_trans_id/mã lỗi hệ thống không kết luận FAILED.
- Order PAYMENT_FAILED được đưa về PENDING qua transition khi thử lại bằng key mới. Không đổi trạng thái do tham số redirect từ browser.
- Thiếu cấu hình trả 503 trước khi tạo Payment. Callback thiếu cấu hình Key2 không được chấp nhận. GET dùng interceptor hiện có; POST Payment tự trả envelope cùng định dạng với HTTP 200/201 nhất quán. Không chỉnh interceptor chung.

## Kiểm thử và giới hạn

Test ký create/query, đối chiếu callback sai/chính xác, v2 response trực tiếp, JWT, số tiền, idempotency đồng thời cùng/khác key, retry, timeout, loyalty và rollback. Dùng node:test + ts-node hiện có; integration database tạo schema tạm riêng và chỉ xóa schema đó. Build cả backend/frontend. AppId/Key1/Key2 người dùng đã cung cấp; đã gọi create/query sandbox thành công, chưa thao tác thanh toán bằng app/thẻ hoặc xác thực callback qua HTTPS thật.

Tài liệu nguồn: https://developers.zalopay.vn/v2/general/overview.html và https://docs.zalopay.vn/vi/docs/developer-tools/knowledge-base/status-codes/. Không có scheduler đối soát nền ở giai đoạn này; các lần PENDING được truy vấn khi khách kiểm tra kết quả, ngoài cửa sổ an toàn 48 giờ cần đối soát thủ công.
