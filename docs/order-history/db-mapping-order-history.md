# Database Mapping – Order History

## 1. Mục tiêu

Mô tả mapping giữa dữ liệu mà phân hệ **Order History** sử dụng và các Prisma
model/cột tương ứng trong PostgreSQL. Tài liệu này làm rõ nguồn dữ liệu cho:

- danh sách lịch sử đơn hàng của người dùng hiện tại (`GET /api/v1/orders/me`);
- bộ lọc theo trạng thái, sắp xếp và phân trang;
- dữ liệu chi tiết đơn hàng khi người dùng mở một mục History
  (`GET /api/v1/orders/:id`, endpoint đề xuất trong use case).

Order History chỉ đọc dữ liệu. Việc truy vấn không được làm thay đổi `Order`,
`OrderItem`, `Payment` hoặc trạng thái đơn hàng.

## 2. Mapping Order History

### 2.1. Trường danh sách lịch sử

| Prisma field | Database column | Kiểu dữ liệu / Ý nghĩa |
|---|---|---|
| `id` | `id` | String, khóa chính CUID; định danh chuẩn dùng làm `orderId` khi mở chi tiết |
| `orderNumber` | `order_number` | Int, mã đơn tự tăng (`orders.order_number`); UI format `#1042` |
| `userId` | `user_id` | String, khóa ngoại tới `users.id`; dùng giới hạn dữ liệu theo JWT |
| `status` | `status` | Enum `PENDING`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `PAYMENT_FAILED`, `CANCELLED` |
| `createdAt` | `created_at` | DateTime, thời điểm tạo đơn theo ISO-8601 |
| `totalAmount` | `total_amount` | Decimal(12,0), tổng tiền hàng trước giảm giá |
| `discountAmount` | `discount_amount` | Decimal(12,0), số tiền giảm giá |
| `finalAmount` | `final_amount` | Decimal(12,0), số tiền khách thực trả |

Tên bảng trong database: `orders`.

`currency` (`VND`) là quy ước hiển thị tiền tệ phía Frontend, không phải cột trong bảng `orders`. `itemCount` là giá trị tổng hợp `SUM(OrderItem.quantity)` của các dòng thuộc đơn hàng.

### 2.2. Trường chi tiết đơn hàng

| Prisma field | Database column | Kiểu dữ liệu / Ý nghĩa |
|---|---|---|
| `OrderItem.id` | `order_items.id` | String, khóa chính của dòng sản phẩm |
| `OrderItem.orderId` | `order_items.order_id` | String, khóa ngoại tới `orders.id` |
| `OrderItem.productId` | `order_items.product_id` | String, khóa ngoại tới `products.id` |
| `OrderItem.size` | `order_items.size` | Enum size `S`, `M`, `L` |
| `OrderItem.quantity` | `order_items.quantity` | Int, số lượng sản phẩm đặt |
| `OrderItem.unitPrice` | `order_items.unit_price` | Decimal(12,0), đơn giá đã chốt tại thời điểm đặt |
| `OrderItem.lineTotal` | `order_items.line_total` | Decimal(12,0), thành tiền của dòng |
| `Product.name` | `products.name` | String, tên sản phẩm hiển thị |
| `OrderItemTopping.id` | `order_item_toppings.id` | String, khóa chính dòng topping |
| `OrderItemTopping.orderItemId` | `order_item_toppings.order_item_id` | String, khóa ngoại tới `order_items.id` |
| `OrderItemTopping.toppingId` | `order_item_toppings.topping_id` | String, khóa ngoại tới `toppings.id` |
| `OrderItemTopping.price` | `order_item_toppings.price` | Decimal(12,0), giá topping được chốt trong đơn |
| `Topping.name` | `toppings.name` | String, tên topping hiển thị |

Tên bảng chính: `order_items`; bảng liên kết topping: `order_item_toppings`.

Tên sản phẩm và tên topping phải được lấy từ quan hệ tương ứng khi cần hiển thị.
Giá trong `OrderItem`/`OrderItemTopping` là giá lịch sử của đơn, không tính lại
theo giá hiện tại trong `products` hoặc `toppings`.

## 3. Truy vấn danh sách và quan hệ dữ liệu

- **Phạm vi dữ liệu:** Backend lấy `userId` từ JWT đã xác thực và lọc
  `orders.user_id = userId`. Không nhận `userId` từ query hoặc body của Client.
- **Lọc trạng thái:** Nếu có query `status`, lọc chính xác trên
  `orders.status`; chỉ chấp nhận các giá trị enum của `OrderStatus`.
- **Thứ tự mặc định:** `orders.created_at DESC`, sau đó `orders.id DESC` (hoặc
  khóa ổn định tương đương) để thứ tự giữa các bản ghi cùng thời điểm không bị
  thay đổi.
- **Phân trang:** `page` bắt đầu từ `1`, mặc định `1`; `limit` mặc định `20`,
  tối đa `50`. Có thể triển khai bằng `skip = (page - 1) * limit` và
  `take = limit`. Trang hợp lệ vượt tổng số trang trả `data: []`.
- **Tổng số dòng:** `pagination.totalItems` là số Order sau khi áp dụng cả
  `userId` và `status`; `totalPages` và `hasNextPage` được tính từ kết quả này.
- **Đếm món:** Nếu API hỗ trợ `itemCount`, tính tổng `order_items.quantity` theo
  từng `order_id`, không đếm số dòng sản phẩm.

Quan hệ sử dụng trong Order History:

- `User 1 - N Order`: một người dùng có nhiều đơn; chỉ đọc các đơn thuộc user
  hiện tại.
- `Order 1 - N OrderItem`: một đơn có các dòng sản phẩm để hiển thị chi tiết.
- `OrderItem N - N Topping` thông qua `OrderItemTopping`: dùng khi chi tiết đơn
  cần hiển thị topping.
- `Order N - 1 Promotion`: không cần trả về trong danh sách History; chỉ join
  khi màn hình chi tiết có yêu cầu hiển thị voucher.

## 4. Mapping với API và Order Detail

### `GET /api/v1/orders/me`

| API field | Nguồn dữ liệu | Quy tắc |
|---|---|---|
| `id` | `orders.id` | Khóa CUID chuẩn để điều hướng tới detail |
| `orderNumber` | `orders.order_number` | Mã số đơn hiển thị (`Int`); UI format `#1042` |
| `status` | `orders.status` | Trạng thái hiện tại thuộc enum `OrderStatus` |
| `totalAmount` | `orders.total_amount` | Tổng tiền hàng |
| `discountAmount` | `orders.discount_amount` | Số tiền giảm giá |
| `finalAmount` | `orders.final_amount` | Số tiền thực trả |
| `createdAt` | `orders.created_at` | Chuỗi ISO-8601 có timezone |
| `itemCount` | `SUM(order_items.quantity)` | Tổng số lượng món trong đơn |

Response thành công giữ envelope chuẩn của `TransformInterceptor`:
`{ success: true, statusCode: 200, data: { items: [...], pagination: { page, limit, total, totalPages, hasNextPage } }, timestamp: "..." }`.
Khi không có dữ liệu, trả `200 OK` với `items: []`, `total: 0`.

### `GET /api/v1/orders/:id` (đề xuất)

Backend phải truy vấn đồng thời `orders.id = :id` và
`orders.user_id = userId` từ JWT. Nếu không tìm thấy hoặc đơn thuộc user khác,
trả `404 Not Found` với message thống nhất `Không tìm thấy đơn hàng`, không làm
lộ sự tồn tại của đơn.

Response detail lấy `Order` cùng `OrderItem`, và khi cần lấy thêm `Product.name`
cùng các `OrderItemTopping`. Không trả `passwordHash`, token, `idempotencyKey`
hoặc dữ liệu Payment nhạy cảm cho màn hình Order Detail.

## 5. Các quy tắc dữ liệu và bảo mật

- Endpoint lịch sử yêu cầu `JwtAuthGuard`; thiếu, hết hạn hoặc sai JWT trả
  `401 Unauthorized`.
- Không cho phép Client chỉ định `userId` để mở rộng phạm vi truy vấn.
- Query `page`, `limit` và `status` phải được validate; dữ liệu không hợp lệ trả
  `400 Bad Request` và không retry cùng query sai.
- Lịch sử chỉ đọc trạng thái hiện tại của `Order`; không tự chuyển trạng thái và
  không ghi thêm `OrderStatusHistory`.
- Không trả `Payment.idempotencyKey`, `requestHash` hoặc thông tin giao dịch
  không cần thiết cho History.
- Dùng `final_amount` làm tổng tiền hiển thị; không tính lại từ giá sản phẩm
  hiện tại vì giá đơn phải giữ nguyên theo thời điểm đặt.
- Các truy vấn danh sách/chi tiết không được cập nhật dữ liệu hoặc làm thay đổi
  tồn kho, điểm thưởng và thanh toán.

## 6. Lưu ý

Mapping này được xây dựng theo `usecase-order-history.md` và thiết kế database
hiện tại. Endpoint chi tiết `/api/v1/orders/:id`, `itemCount`, tên trường
`orderCode` và metadata `pagination` là các quy ước/đề xuất của use case, cần
được Backend xác nhận trước khi triển khai migration hoặc API chính thức.
Kiểu dữ liệu PostgreSQL cuối cùng phụ thuộc `schema.prisma` và migration thực tế
của nhóm.