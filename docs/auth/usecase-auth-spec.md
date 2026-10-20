# 🔐 ĐẶC TẢ USE CASE PHÂN HỆ XÁC THỰC (AUTH SPECIFICATION)
### Tác giả: Phạm Minh Chiến (Owner Feature: Auth & Hệ Thống)
**Dự án:** BrewLite – Hệ Thống Đặt Cà Phê Không Dùng Tiền Mặt  
**Môn học:** Công nghệ Phần mềm | **Học kỳ:** I – 2026–2027  
**Phạm vi:** Đáp ứng Task 7 (Đăng ký / Đăng nhập JWT) và thiết lập tài liệu mẫu (Template) cho 6 thành viên còn lại.

---

## 1. TỔNG QUAN PHÂN HỆ (MODULE OVERVIEW)
Phân hệ Xác thực (Authentication) chịu trách nhiệm nhận diện khách hàng, bảo mật mật khẩu, phát hành mã định danh JWT Token và bảo vệ các tuyến API nhạy cảm (như Đặt hàng `POST /orders`, Xem lịch sử `GET /orders/me`) khỏi truy cập trái phép.

* **Các ca sử dụng cốt lõi:**
  1. **`UC-AUTH-01`**: Đăng ký tài khoản khách hàng mới (Register)
  2. **`UC-AUTH-02`**: Đăng nhập hệ thống & Nhận JWT Access Token (Login)
  3. **`UC-AUTH-03`**: Xác thực Token qua AuthGuard & Bảo vệ Endpoint (Guard)

---

## 2. BẢNG ĐẶC TẢ CHI TIẾT (USE CASE SPECIFICATIONS)

### 📄 UC-AUTH-01: ĐĂNG KÝ TÀI KHOẢN (REGISTER)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-AUTH-01` |
| **Tên Use Case** | Đăng ký tài khoản người dùng mới |
| **Actor chính** | Khách hàng (Customer) |
| **Mục đích** | Tạo hồ sơ khách hàng mới để tham gia tích lũy điểm thưởng và đặt đồ uống. |
| **Điều kiện tiên quyết (Pre-condition)** | Người dùng đang mở ứng dụng web BrewLite và chưa đăng nhập. |
| **Điều kiện kết thúc (Post-condition)** | Bản ghi người dùng mới được tạo trong bảng `users` với mật khẩu đã băm, cấp ngay mã JWT để tự động đăng nhập. |

#### Luồng sự kiện chính (Main Flow - Happy Path):
1. Khách hàng nhấn nút **"Đăng ký"** trên Header hoặc Modal.
2. Hệ thống hiển thị form nhập gồm: Email, Mật khẩu, Xác nhận mật khẩu, Họ và tên.
3. Khách hàng điền thông tin hợp lệ và nhấn nút **"Tạo tài khoản"**.
4. Frontend gửi yêu cầu `POST /api/v1/auth/register` kèm body JSON.
5. Backend (`ValidationPipe`) kiểm tra định dạng email và độ dài mật khẩu ($\ge 6$ ký tự).
6. Backend kiểm tra tính duy nhất của email trong CSDL:
   - *Kết quả:* Email chưa từng tồn tại.
7. Backend thực hiện băm mật khẩu bằng thư viện `bcrypt` với `saltRounds = 10`.
8. Backend lưu bản ghi mới vào bảng `users` (gán `loyaltyPoints = 0`).
9. Backend ký mã JWT Access Token chứa payload `{ sub: user.id, email: user.email }` với thời hạn 7 ngày.
10. Backend trả về phản hồi `201 Created` kèm token và thông tin người dùng.
11. Frontend lưu Access Token vào `localStorage`, cập nhật trạng thái Header hiển thị tên khách hàng và đóng form đăng ký.

#### Các luồng thay thế & ngoại lệ (Alternative & Exception Flows):
* **E1: Email đã được sử dụng trước đó (409 Conflict):**
  * Tại bước 6, nếu email đã tồn tại trong bảng `users`, Backend ném `ConflictException: "Email này đã được sử dụng"`.
  * Frontend bắt lỗi và hiển thị thông báo đỏ dưới ô nhập email: *"Email đã tồn tại, vui lòng đăng nhập hoặc dùng email khác"*.
* **E2: Dữ liệu nhập không hợp lệ (400 Bad Request):**
  * Tại bước 5, nếu email sai định dạng hoặc mật khẩu $< 6$ ký tự, `class-validator` ném `BadRequestException`.
  * Frontend hiển thị danh sách các trường vi phạm để người dùng chỉnh sửa.

---

### 📄 UC-AUTH-02: ĐĂNG NHẬP HỆ THỐNG & NHẬN JWT (LOGIN)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-AUTH-02` |
| **Tên Use Case** | Đăng nhập hệ thống |
| **Actor chính** | Khách hàng (Customer) |
| **Mục đích** | Xác minh danh tính người dùng và cấp mã ủy quyền truy cập hệ thống. |
| **Pre-condition** | Người dùng đã có tài khoản trong hệ thống. |
| **Post-condition** | Cấp mã JWT Token có hiệu lực; nạp số dư điểm loyalty hiện có. |

#### Luồng sự kiện chính (Main Flow):
1. Khách hàng nhấn nút **"Đăng nhập"** trên Header hoặc tại màn hình giỏ hàng khi tiến hành checkout.
2. Hệ thống hiển thị form đăng nhập (Email, Mật khẩu).
3. Khách hàng nhập email, mật khẩu và bấm **"Đăng nhập"**.
4. Frontend gửi `POST /api/v1/auth/login`.
5. Backend tìm kiếm bản ghi theo email trong bảng `users`.
6. Backend so khớp mật khẩu người dùng nhập với `password_hash` trong DB bằng hàm `bcrypt.compare()`.
   - *Kết quả:* Mật khẩu hoàn toàn trùng khớp.
7. Backend ký JWT Token bằng `JWT_SECRET` bí mật.
8. Backend trả về `200 OK` chứa `{ accessToken, user: { id, email, fullName, loyaltyPoints } }`.
9. Frontend lưu `accessToken` và đồng bộ state người dùng trên toàn ứng dụng.

#### Các luồng ngoại lệ (Exception Flows):
* **E1: Sai email hoặc mật khẩu (401 Unauthorized):**
  * Tại bước 5 (không tìm thấy email) hoặc bước 6 (mật khẩu không khớp), Backend ném `UnauthorizedException: "Email hoặc mật khẩu không chính xác"`.
  * Frontend hiển thị thông báo lỗi bảo mật chung (không tiết lộ là sai email hay sai mật khẩu để phòng ngừa tấn công dò quét).

---

### 📄 UC-AUTH-03: XÁC THỰC JWT QUA GUARD (ROUTE PROTECTION)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-AUTH-03` |
| **Tên Use Case** | Xác thực JWT và bảo vệ tuyến API |
| **Actor** | Hệ thống BrewLite (System / AuthGuard) |
| **Mục đích** | Kiểm soát quyền truy cập các endpoint nhạy cảm (Đặt hàng, Xem đơn cá nhân). |

#### Luồng xử lý kỹ thuật:
1. Client gửi request kèm Header: `Authorization: Bearer <accessToken>`.
2. NestJS `JwtAuthGuard` chặn request trước khi vào Controller.
3. Guard giải mã Token, kiểm tra chữ ký HMAC-SHA256 và kiểm tra ngày hết hạn (`exp`).
4. Nếu hợp lệ, Guard gắn thông tin user vào request object: `req.user = { sub, email }` (theo Quyết định D4, trích xuất từ payload của Token).
5. Nếu Token không tồn tại, hết hạn hoặc sai chữ ký $\rightarrow$ Trả về `401 Unauthorized: "Vui lòng đăng nhập để tiếp tục"`.

---

## 3. QUY TẮC NGHIỆP VỤ & BẢO MẬT (BUSINESS RULES)

1. **BR-AUTH-01 (Mật khẩu an toàn):** Mật khẩu phải có độ dài từ 6 ký tự trở lên. Không bao giờ lưu trữ mật khẩu dạng văn bản thô (plain text). Bắt buộc băm qua thuật toán `bcrypt` với muối (Salt Round) là 10.
2. **BR-AUTH-02 (Chu kỳ sống của JWT):** Thời gian hết hạn của JWT Access Token được cấu hình là `7d` (7 ngày) qua biến môi trường `JWT_EXPIRATION`.
3. **BR-AUTH-03 (Tích lũy Loyalty ban đầu):** Người dùng đăng ký mới có điểm tích lũy khởi điểm là 0 (`loyalty_points = 0`).
4. **BR-AUTH-04 (Bảo vệ Route):** Các API bắt buộc phải có `JwtAuthGuard`:
   - `POST /api/v1/orders` (Tạo đơn hàng)
   - `POST /api/v1/orders/:id/cancel` (Hủy đơn hàng - Quyết định D6)
   - `GET /api/v1/orders/me` (Lịch sử đơn cá nhân)
   - `POST /api/v1/payments` (Thanh toán đơn hàng)

---

## 4. HỢP ĐỒNG API (API CONTRACT & SAMPLES)

### 4.1. Đăng ký tài khoản: `POST /api/v1/auth/register`
* **Request Body:**
  ```json
  {
    "email": "customer@example.com",
    "password": "Password@123",
    "fullName": "Nguyễn Văn A"
  }
  ```
* **Response Thành công (201 Created):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "cm2...",
        "email": "customer@example.com",
        "fullName": "Nguyễn Văn A",
        "loyaltyPoints": 0
      }
    },
    "timestamp": "2026-10-06T16:00:00.000Z"
  }
  ```

### 4.2. Đăng nhập: `POST /api/v1/auth/login`
* **Request Body:**
  ```json
  {
    "email": "demo@brewlite.test",
    "password": "Demo@12345"
  }
  ```
* **Response Thành công (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "cm2...",
        "email": "demo@brewlite.test",
        "fullName": "Khách hàng Demo",
        "loyaltyPoints": 120
      }
    },
    "timestamp": "2026-10-06T16:00:00.000Z"
  }
  ```

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D4, D6 (ngày 2026-10-16).*
