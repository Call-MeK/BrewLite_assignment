# Chuẩn bị tích hợp VNPay / ZaloPay sau Payment Mock

Ngày đối chiếu tài liệu nhà cung cấp: 20/10/2026.

> Đã triển khai ZaloPay sandbox v2 theo cấu hình người dùng. Hướng dẫn chạy hiện hành: [zalopay-setup.md](zalopay-setup.md). File này lưu hướng dẫn chuẩn bị ban đầu cho cả hai nhà cung cấp; VNPay chưa triển khai.

MVP ban đầu dùng Mock Payment Gateway, hiện đã chuyển sang ZaloPay sandbox v2. Phần VNPay dưới đây là đề xuất chưa triển khai. Callback ZaloPay hiện dùng `/api/v1/payments/zalopay/callback`.

## 1. Những việc có thể chuẩn bị trước

1. Chọn một nhà cung cấp để thử sandbox trước.
2. Đăng ký thông tin kết nối theo hướng dẫn tương ứng bên dưới.
3. Chuẩn bị URL HTTPS công khai trỏ tới backend cổng 4000, bằng hosting hoặc tunnel. `localhost` không nhận được thông báo từ máy chủ nhà cung cấp. Không mở công khai PostgreSQL.
4. Lưu khóa bí mật trong `backend/.env` trên máy của bạn; file này được `.gitignore` loại trừ. Không dùng tiền tố `NEXT_PUBLIC_` cho khóa bí mật.
5. Chỉ gửi tên nhà cung cấp, mã merchant/app, URL công khai và thông báo đã điền khóa. Không cần gửi mật khẩu, secret hay toàn bộ file `.env` qua chat.

## 2. VNPay sandbox

1. Vào [đăng ký Merchant môi trường test](https://sandbox.vnpayment.vn/devreg/).
2. Điền tên website BrewLite, URL website, email, mật khẩu và mã xác nhận theo biểu mẫu. Nếu biểu mẫu yêu cầu URL công khai, dùng URL đã chuẩn bị ở bước 1.
3. Kiểm tra email nhận thông tin kết nối. Theo [tài liệu kết nối VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), cần `vnp_TmnCode` và `vnp_HashSecret`.
4. Khi bắt đầu triển khai adapter VNPay, thêm cấu hình sau vào `backend/.env`, thay các giá trị mẫu trên máy của bạn:

   ```dotenv
   VNPAY_TMN_CODE=<vnp_TmnCode được cấp>
   VNPAY_HASH_SECRET=<vnp_HashSecret được cấp>
   VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
   VNPAY_RETURN_URL=https://<backend-public>/api/v1/payments/vnpay/return
   VNPAY_IPN_URL=https://<backend-public>/api/v1/payments/vnpay/ipn
   ```

5. Đăng ký/cập nhật IPN URL theo quy trình VNPay cấp cho merchant. Return URL đưa trình duyệt khách hàng về website; IPN URL nhận kết quả giữa hai máy chủ. Đường dẫn trên chỉ được sử dụng sau khi đã triển khai endpoint tương ứng.
6. Báo lại: đã có TmnCode, đã điền secret và URL HTTPS backend. Không gửi HashSecret.
7. Sau khi adapter được triển khai, kiểm thử bằng dữ liệu thẻ sandbox trong [hướng dẫn chính thức](https://sandbox.vnpayment.vn/apis/docs/gioi-thieu/). Không dùng thẻ thật.

Adapter sẽ ký URL thanh toán, kiểm tra chữ ký kết quả, merchant, mã lần thanh toán và số tiền từ database. Số tiền VNPay gửi đi theo quy ước nhân 100; cần đối chiếu khi nhận IPN. Chỉ cập nhật thanh toán sau khi xác thực kết quả; không coi việc trình duyệt quay về trang thành công là bằng chứng đã thu tiền.

## 3. ZaloPay sandbox

1. Làm theo [quy trình tích hợp ZaloPay](https://docs.zalopay.vn/vi/docs/developer-tools/integration-guide/): cung cấp số điện thoại và email cho bộ phận hỗ trợ/BD của ZaloPay để được tạo tài khoản sandbox. Đăng ký production là quy trình riêng.
2. Nhận AppId và các khóa sandbox; kiểm tra quyền truy cập [Merchant Portal sandbox](https://sbmc.zalopay.vn/).
3. Khi bắt đầu triển khai adapter ZaloPay, thêm vào `backend/.env`:

   ```dotenv
   ZALOPAY_APP_ID=<app_id được cấp>
   ZALOPAY_KEY1=<key1 được cấp>
   ZALOPAY_KEY2=<key2 được cấp>
   ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create
   ZALOPAY_CALLBACK_URL=https://<backend-public>/api/v1/payments/zalopay/callback
   ZALOPAY_REDIRECT_URL=https://<frontend-public>/payments
   ```

4. Cung cấp callback URL khi tạo giao dịch hoặc cấu hình URL mặc định trong portal theo sản phẩm được cấp. Chỉ khai báo các đường dẫn trên sau khi chúng đã được triển khai.
5. Báo lại: đã có AppId, đã điền Key1/Key2 và các URL công khai. Không gửi hai khóa.
6. Dùng ví/app kiểm thử theo hướng dẫn ZaloPay và kiểm tra callback log trong sandbox portal.

Theo [API tạo và truy vấn giao dịch](https://developer.zalopay.vn/v2/general/overview.html), Key1 dùng để ký yêu cầu; theo [hợp đồng callback](https://docs.zalopay.vn/docs/developer-tools/knowledge-base/callback/), Key2 dùng xác thực callback. Callback phải truy cập được từ máy chủ ZaloPay. Adapter cần đối chiếu AppId, mã lần thanh toán và số tiền trước khi ghi nhận thành công.

## 4. Thay đổi cần có khi chuyển từ Mock sang cổng thật

- API tạo thanh toán sẽ trả URL/QR để khách thực hiện giao dịch; Payment còn `PENDING` trong khi chờ xác nhận. Frontend cần đọc trạng thái thanh toán từ backend.
- Xác nhận thanh toán qua IPN/callback có kiểm tra chữ ký; xử lý callback lặp mà không cộng điểm hoặc ghi nhận thanh toán hai lần.
- Không áp dụng máy móc quy tắc Mock “timeout là FAILED” cho yêu cầu thu tiền thật. Timeout có thể xảy ra sau khi nhà cung cấp đã xử lý; cần truy vấn/đối soát trước khi cho phép tạo lần thu tiền mới.
- Khi có cổng thật, loại bỏ khả năng mặc định thành công của Mock trên luồng thu tiền. Mock ở production theo docs hiện tại chỉ dành cho bản demo, không chứng minh tiền đã được chuyển.
- Cập nhật API contract, trạng thái UI và test case cho luồng bất đồng bộ trước khi sử dụng tiền thật.

## 5. Danh sách kiểm thử sandbox cùng nhau

1. Thanh toán thành công, số tiền khớp với đơn và điểm thưởng chỉ cộng một lần.
2. Khách hủy hoặc ngân hàng/ví từ chối; giỏ hàng giữ nguyên.
3. Reload trang kết quả, gửi lại request với cùng Idempotency-Key và nhận callback lặp.
4. Callback sai chữ ký, sai merchant/app, sai số tiền hoặc sai mã lần thanh toán bị từ chối.
5. Mất mạng, timeout, callback chậm; truy vấn trạng thái trước khi thử thu tiền lại.
6. Hai yêu cầu thanh toán đồng thời cho cùng đơn không tạo hai lần thu tiền.

Mac=ebe5df00d5e1ba9cfb91c285599343f9ad13c008a0dfd921609d53a283ae816e
key1=PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL

