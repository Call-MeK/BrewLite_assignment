# 📄 USE CASE SPECIFICATION: QUẢN LÝ GIỎ HÀNG (CART)

## 1. Thông tin chung
* **Mã Use Case:** UC-CART-01
* **Tên Use Case:** Quản lý Giỏ hàng và Khởi tạo đơn (Manage Cart & Checkout)
* **Tác nhân (Actor):** Khách hàng (Customer) - bao gồm cả Khách vãng lai khi xem/sửa và Khách hàng đã đăng nhập khi tiến hành thanh toán.
* **Mô tả ngắn gọn:** Cho phép Khách hàng xem danh sách các món đồ uống đã chọn, tùy chỉnh số lượng, xóa từng món, tự động tính tổng tiền và xác nhận chuyển sang bước Đặt hàng & Thanh toán.

## 2. Điều kiện
* **Tiền điều kiện (Pre-conditions):**
  * Hệ thống hoạt động bình thường.
  * Khách hàng đã thêm ít nhất 1 sản phẩm vào giỏ hàng từ trang Menu hoặc Chi tiết sản phẩm.
  * Khách hàng có thể là Khách vãng lai (Guest) khi duyệt món, thêm vào giỏ và xem/chỉnh sửa giỏ hàng (lưu cục bộ tại trình duyệt qua Zustand Persist / LocalStorage).
  * **Yêu cầu bắt buộc khi Thanh toán:** Khách hàng phải đăng nhập thành công và sở hữu JWT Bearer Token hợp lệ để gọi API tạo đơn (`POST /api/v1/orders`).
* **Hậu điều kiện (Post-conditions):**
  * Trạng thái Giỏ hàng (Local State / LocalStorage) được bảo toàn và lưu thêm `pendingOrderId` sau khi tạo đơn `PENDING` thành công (KHÔNG làm sạch giỏ tại bước tạo đơn - Quyết định D2). Chỉ làm sạch giỏ (`clearCart()`) và xóa `pendingOrderId` khi đơn hàng thanh toán thành công (`PAID`).
  * Một bản ghi Đơn hàng (`Order`) mới được tạo trong Cơ sở dữ liệu với trạng thái `PENDING` và `orderNumber` tự động tăng.
  * Các bản ghi Chi tiết đơn hàng (`OrderItem`) và Topping (`OrderItemTopping`) được tạo tương ứng với số lượng và đơn giá được Backend kiểm tra đối chiếu.
  * Khách hàng được chuyển hướng sang giao diện Thanh toán với `id` đơn hàng tương ứng.

## 3. Basic Flow (Luồng sự kiện chính)
1. Khách hàng nhấn vào biểu tượng Giỏ hàng trên thanh Header hoặc nút "Xem giỏ hàng".
2. Hệ thống (Frontend) mở giao diện Giỏ hàng (Cart Drawer hoặc Cart Page), đọc dữ liệu từ Zustand State (`useCartStore`).
3. Hệ thống hiển thị danh sách các món đồ uống đã chọn (tên món, hình ảnh, size, danh sách topping, số lượng và tạm tính từng dòng).
4. Hệ thống tự động tính toán và hiển thị tổng số lượng món (Badge) và tổng tiền tạm tính.
5. Khách hàng nhấn nút **"Thanh toán"**.
6. Hệ thống (Frontend) kiểm tra trạng thái xác thực người dùng:
   * Nếu Khách hàng đã đăng nhập (đã có Token JWT hợp lệ): Tiếp tục bước 7.
   * Nếu Khách hàng chưa đăng nhập: Hệ thống thực hiện luồng thay thế **4.2 (Xác thực người dùng)**.
7. Frontend hiển thị trạng thái đang xử lý (Loading State, vô hiệu hóa các nút bấm) và gửi request payload (`POST /api/v1/orders`) kèm Header `Authorization: Bearer <token>` xuống Backend.
8. Backend nhận request qua `AuthGuard`, kiểm tra định dạng dữ liệu thông qua `ValidationPipe` và `CreateOrderDto` (`1 <= quantity <= 99`, `size in ['S', 'M', 'L']`, ...).
9. Backend truy vấn Database để kiểm tra trạng thái mở bán (`isAvailable`), số lượng tồn kho (`stock`) và tính toán lại đơn giá chính xác (`basePrice + sizePrice + toppingPrices`).
10. Backend khởi tạo đơn hàng thành công trong CSDL (Order `PENDING`, OrderItem, OrderItemTopping) và trả về phản hồi chuẩn với mã `201 Created` kèm `id` đơn hàng.
11. Frontend tắt Loading State, lưu `pendingOrderId` vào giỏ hàng (`useCartStore`) (giữ nguyên các món trong giỏ) và chuyển hướng Khách hàng sang màn hình Thanh toán với `id` đơn hàng được trả về. (Nếu sau đó Khách hàng quay lại giỏ và thay đổi món, hệ thống sẽ gọi `POST /api/v1/orders/:id/cancel` cho đơn cũ trước khi tạo đơn mới. Khi thanh toán thành công `PAID`, Frontend mới gọi `clearCart()` và xóa `pendingOrderId`).

## 4. Alternative Flows (Luồng thay thế)

### 4.1. Cập nhật số lượng / Xóa món trong giỏ
* Tại bước 3 của luồng chính, Khách hàng có thể:
  * Tăng số lượng (`+`) hoặc giảm số lượng (`-`) của một món: Hệ thống cập nhật trường `quantity` của `CartItem` tương ứng qua `cartItemId`. Nếu số lượng giảm về 0, hệ thống tự động xóa món đó khỏi giỏ hàng.
  * Nhấn biểu tượng Thùng rác (Xóa món): Hệ thống loại bỏ dòng `CartItem` tương ứng ra khỏi danh sách.
* Frontend cập nhật lại Zustand State và đồng bộ ngay vào LocalStorage (không cần gọi API server).
* Hệ thống tự động tính toán lại tổng tiền tạm tính và số lượng hiển thị trên Badge.
* Quay lại bước 3 của luồng chính.

### 4.2. Yêu cầu đăng nhập trước khi tạo đơn (Guest Checkout)
* Tại bước 6 của luồng chính, nếu Frontend phát hiện người dùng chưa đăng nhập:
* Hệ thống lưu đường dẫn chuyển hướng quay lại (redirect URL) và điều hướng Khách hàng sang trang Đăng nhập (`/auth/login`). Trạng thái giỏ hàng vẫn được bảo toàn trong LocalStorage.
* Sau khi Khách hàng đăng nhập thành công và nhận được JWT token, hệ thống tự động điều hướng Khách hàng trở lại Giỏ hàng để tiếp tục bước 7 của luồng chính.

## 5. Exception Flows (Luồng ngoại lệ)

### 5.1. Giỏ hàng trống (Empty State)
* Tại bước 2 của luồng chính, nếu danh sách `items` trong giỏ hàng rỗng (`items.length === 0`):
* Hệ thống hiển thị giao diện "Giỏ hàng của bạn đang trống" kèm hình minh họa.
* Hệ thống vô hiệu hóa nút "Thanh toán".
* Khách hàng nhấn nút "Khám phá thực đơn" để đóng giỏ hàng và duyệt món tại trang Menu.

### 5.2. Lỗi dữ liệu đầu vào (Bad Request - 400 Validation Error)
* Tại bước 8 của luồng chính, Backend phát hiện Payload gửi lên bị sai định dạng (ví dụ: `quantity <= 0`, thiếu `productId`, sai enum `size`):
* Backend từ chối xử lý, trả về mã lỗi `400 Bad Request` kèm mảng chi tiết các lỗi validation (bọc qua `AllExceptionsFilter`).
* Frontend tắt Loading State, hiển thị Toast cảnh báo lỗi dữ liệu và yêu cầu Khách hàng kiểm tra lại.

### 5.3. Hết hàng hoặc Lệch giá (Business Logic Error - 400 Bad Request)
* Tại bước 9 của luồng chính, Backend kiểm tra trong DB và phát hiện:
  * Sản phẩm tạm ngưng bán (`isAvailable = false`) hoặc tồn kho không đủ (`stock < quantity`).
  * Hoặc đơn giá của sản phẩm/topping vừa được cập nhật bởi Quản trị viên.
* Backend từ chối tạo đơn, trả về mã lỗi `400 Bad Request` kèm thông báo chi tiết (ví dụ: *"Sản phẩm Cà phê sữa (Size M) đã hết hàng"*).
* Frontend tắt Loading State, hiển thị thông báo lỗi nổi bật trên giao diện Giỏ hàng.
* Khách hàng điều chỉnh số lượng hoặc xóa món không hợp lệ và tiếp tục từ bước 3 của luồng chính.

### 5.4. Phiên đăng nhập hết hạn (401 Unauthorized)
* Tại bước 7 của luồng chính, nếu JWT token của Khách hàng đã hết hạn hoặc không hợp lệ:
* Backend từ chối yêu cầu và trả về lỗi `401 Unauthorized`.
* Frontend tắt Loading State, xóa token cũ nhưng **vẫn giữ nguyên giỏ hàng trong LocalStorage**, hiển thị thông báo "Phiên đăng nhập đã hết hạn" và chuyển hướng Khách hàng sang trang Đăng nhập lại.

## 6. Dữ liệu liên quan (Related Data / Entities)

### 6.1. Dữ liệu Frontend (Local State / Zustand)
* **`CartItem`:** Chứa thông tin hiển thị tại client gồm `id` (khóa định danh duy nhất của dòng món kết hợp `productId`, `size`, `toppingIds`), `productId`, `name`, `imageUrl`, `size`, `toppingIds`, `quantity`, `estimatedUnitPrice`.
* **`CartState`:** Lưu danh sách `items`, `totalAmount`, `badgeCount` và các actions (`addItem`, `removeItem`, `updateQuantity`, `clearCart`), được lưu giữ qua `localStorage` bằng middleware `persist`.

### 6.2. Dữ liệu Backend (Database PostgreSQL / Prisma)
* **Bảng `Product`, `ProductSizePrice`, `Topping` (Read-only):** Truy xuất để kiểm tra `isAvailable`, `stock`, `basePrice`, `priceAdjustment` và giá topping nhằm tính toán lại giá chính xác và trừ tồn kho khi đơn hàng được xác nhận.
* **Bảng `Order` (Create):** Khởi tạo bản ghi đơn hàng với `userId`, `status = PENDING`, `totalAmount`, `discountAmount`, `finalAmount`.
* **Bảng `OrderItem` (Create):** Lưu từng dòng sản phẩm với `orderId`, `productId`, `size`, `quantity`, `unitPrice`, `lineTotal`.
* **Bảng `OrderItemTopping` (Create):** Lưu các topping đi kèm với từng `orderItemId` cùng với giá `price` tại thời điểm đặt hàng.

---

## 7. Quy tắc nghiệp vụ (Business Rules)

| Mã quy tắc | Tên quy tắc | Nội dung chi tiết |
| :--- | :--- | :--- |
| **BR-CART-01** | Số lượng tối thiểu mỗi món | Số lượng (`quantity`) của mỗi món trong giỏ hàng và trong payload tạo đơn tối thiểu phải là 1 (`quantity >= 1`). DTO Backend bắt buộc kiểm tra bằng `@Min(1, { message: 'Số lượng mỗi món phải lớn hơn hoặc bằng 1' })`. |
| **BR-CART-02** | Tự động xóa khi số lượng <= 0 | Khi Khách hàng giảm số lượng của một món về 0 hoặc số âm (`quantity <= 0`), hệ thống tự động loại bỏ (`removeItem`) món đó khỏi giỏ hàng mà không cần thêm thao tác xác nhận xóa. |
| **BR-CART-03** | Khóa thanh toán khi giỏ hàng rỗng | Khi giỏ hàng không có sản phẩm nào (`items.length === 0`), giao diện hiển thị trạng thái rỗng (Empty State) và vô hiệu hóa nút "Thanh toán". Backend từ chối tạo đơn với mảng items rỗng bằng `@ArrayNotEmpty({ message: 'Giỏ hàng không được để trống khi đặt hàng' })`. |
| **BR-CART-04** | Gộp dòng trùng theo Composite Key | Các món có cùng cấu hình thuộc tính sẽ được gộp vào chung một dòng và cộng dồn số lượng. Khóa định danh composite key được tính theo công thức: `${productId}-${size}-${[...toppingIds].sort().join('-')}` để phân biệt chính xác từng cấu hình (kể cả cùng sản phẩm, cùng size nhưng khác topping). |
| **BR-CART-05** | Tổng tiền do Backend tính toán lại | Đơn giá (`estimatedUnitPrice`) và tổng tiền (`totalAmount`) tại Frontend chỉ mang tính chất hiển thị tạm tính cho người dùng. Khi gửi request tạo đơn, client KHÔNG gửi giá tiền. Backend bắt buộc truy vấn CSDL để lấy giá gốc (`Product.basePrice`), phụ thu kích cỡ (`ProductSizePrice.priceAdjustment`), giá từng topping (`Topping.price`) và tính toán lại toàn bộ `totalAmount`, `discountAmount`, `finalAmount`. |
| **BR-CART-06** | Không tin cậy giá từ Client (Zero Trust Pricing) | Backend tuyệt đối không tin tưởng bất kỳ thông tin đơn giá nào do Client gửi lên nhằm phòng chống tấn công thao túng giá (price tampering). Mọi đơn giá, phụ phí và chiết khấu đều phải được xác thực từ CSDL và Promotion Engine tại máy chủ. |
| **BR-CART-07** | Giới hạn số lượng tối đa mỗi món | Giới hạn số lượng cho mỗi dòng sản phẩm trong giỏ hàng và payload đặt hàng là từ 1 đến 99 ly (`1 <= quantity <= 99`) nhằm tránh lỗi tràn số, đơn hàng ảo hoặc sự cố vận hành tại quầy. DTO Backend kiểm tra bằng `@Min(1)` và `@Max(99)`. |
| **BR-CART-08** | Giới hạn số lượng topping mỗi món | Mỗi món đồ uống được chọn tối đa 3 loại topping không trùng lặp (khớp với seed data gồm 3 topping khả dụng). DTO Backend kiểm tra bằng `@ArrayMaxSize(3)` và `@ArrayUnique()`. |

---

## 8. Giả định / Câu hỏi mở

### [Q1] Giới hạn số lượng tối đa cho mỗi dòng sản phẩm và toàn bộ giỏ hàng

**Đã chốt (Quyết định D5)**:
- Thống nhất giới hạn số lượng mỗi dòng sản phẩm: `1 <= quantity <= 99` ở cả Frontend UI và Backend DTO (`@Min(1)`, `@Max(99)`).

### [Q2] Chuẩn hóa trường mã đơn hàng trả về: `id` thay cho `orderId`

**Đã chốt (Quyết định D1, D6)**:
- Đã chuẩn hóa trường mã đơn hàng trong response `POST /api/v1/orders` thành `id` theo đúng `docs/naming-convention.md` (Primary Key luôn là `id`). Phân hệ Payment và Order đều sử dụng `orderId` trong quan hệ và `id` trong khóa chính.

### [Q3] Giới hạn topping cho mỗi món trong giỏ hàng

**Đã chốt**:
- Mỗi món chỉ được chọn tối đa 3 loại topping không trùng lặp, xác thực bằng `@ArrayMaxSize(3)` và `@ArrayUnique()` trong DTO.

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D2, D5 (ngày 2026-10-16).*