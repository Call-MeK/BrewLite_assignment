# API Contract – Order History

## 1. Phạm vi chức năng

Hợp đồng này mô tả các API phục vụ chức năng **Lịch sử đơn hàng** của BrewLite:

- Lấy danh sách đơn hàng của người dùng hiện tại.
- Lọc danh sách theo trạng thái đơn hàng.
- Phân trang ổn định theo thời gian tạo.
- Lấy chi tiết một đơn hàng được chọn từ danh sách lịch sử.

Các API chỉ đọc dữ liệu. Chúng không tạo, cập nhật, hủy đơn hàng hoặc thay đổi
trạng thái thanh toán.

### 1.1. Quy ước chung

| Nội dung | Quy ước |
|---|---|
| Base path | `/api/v1` |
| Định dạng | `application/json` |
| Xác thực | JWT access token trong header `Authorization` |
| Múi giờ | Giá trị thời gian trả về theo ISO-8601 có timezone |
| Tiền tệ | `VND`; số tiền là số nguyên, đơn vị đồng |
| Trạng thái đơn | `PENDING`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `PAYMENT_FAILED`, `CANCELLED` |
| Sắp xếp mặc định | `createdAt DESC`, sau đó `id DESC` để bảo đảm thứ tự ổn định |

`userId` không phải là tham số của API. Backend phải lấy danh tính người dùng
từ JWT đã được `JwtAuthGuard` xác thực.

## 2. Quy tắc response chung

### 2.1. Response thành công

Tất cả response thành công phải tuân theo format của `TransformInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {},
  "timestamp": "2026-10-09T08:35:00.000Z"
}
```

- API danh sách luôn trả `data` là một mảng.
- API chi tiết trả `data` là một object.
- `timestamp` là thời điểm Backend tạo response, không phải `createdAt` của đơn.

### 2.2. Response lỗi

Tất cả lỗi phải được xử lý bởi cơ chế exception chuẩn của Backend
(`AllExceptionsFilter`), không trả stack trace hoặc dữ liệu nội bộ:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "page must not be less than 1"
  ],
  "timestamp": "2026-10-09T08:35:00.000Z",
  "path": "/api/v1/orders/me?page=0"
}
```

Với lỗi nghiệp vụ, `message` là chuỗi; với lỗi `ValidationPipe`, `message` là
mảng các thông báo validation.

## 3. API lấy lịch sử đơn hàng

### 3.1. Endpoint

- **Method:** `GET`
- **URL:** `/api/v1/orders/me`
- **Authentication:** Bắt buộc JWT
- **Request body:** Không có

### 3.2. Request headers

```http
Authorization: Bearer <access-token>
Accept: application/json
```

JWT hoặc secret không được truyền trong query string và không được ghi vào log.

### 3.3. Query parameters

| Tên | Kiểu | Bắt buộc | Mặc định / giới hạn | Mô tả |
|---|---|:---:|---|---|
| `page` | integer | Không | `1`, tối thiểu `1` | Số trang, bắt đầu từ 1. |
| `limit` | integer | Không | `20`, từ `1` đến `50` | Số đơn tối đa trong một trang. |
| `status` | enum string | Không | Không lọc | Một trong các trạng thái đơn hàng đã quy định. |

Ví dụ request không lọc:

```http
GET /api/v1/orders/me?page=1&limit=20
Authorization: Bearer <access-token>
Accept: application/json
```

Ví dụ request có lọc:

```http
GET /api/v1/orders/me?page=1&limit=10&status=COMPLETED
Authorization: Bearer <access-token>
Accept: application/json
```

Backend phải dùng DTO query có `class-validator` và bật transform phù hợp để
kiểm tra kiểu số. Các giá trị `page=0`, `limit=0`, `limit=51`, số không hợp lệ
hoặc `status` ngoài enum phải bị từ chối trước khi truy vấn repository.

### 3.4. Quy tắc truy vấn

1. Lấy `userId` từ request đã xác thực; không nhận `userId` từ Client.
2. Chỉ truy vấn các Order có `Order.userId` bằng `userId` hiện tại.
3. Nếu có `status`, lọc theo đúng trạng thái hiện tại của Order.
4. Sắp xếp theo `createdAt DESC, id DESC`.
5. Áp dụng offset theo công thức `(page - 1) * limit`.
6. Tính `totalItems`, `totalPages` và `hasNextPage` trên cùng điều kiện lọc.
7. Chỉ trả các trường được phép trong bảng dữ liệu tóm tắt; không trả dữ liệu
   xác thực, thông tin thanh toán bí mật, `idempotencyKey` hoặc trường nội bộ.
8. Truy vấn không được ghi hoặc cập nhật Order, OrderItem, Payment.
9. Nếu `page` hợp lệ nhưng lớn hơn tổng số trang, trả `200` với `data: []`.

### 3.5. Response thành công

**HTTP status:** `200 OK`

Response bọc tự động qua `TransformInterceptor` (dữ liệu trả về từ controller nằm trong `data` gồm mảng `items` và object `pagination`):

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "id": "cmv5t0qeq0000mq6wzi4wzbl2",
        "orderNumber": 1042,
        "status": "PREPARING",
        "totalAmount": 125000,
        "discountAmount": 0,
        "finalAmount": 125000,
        "createdAt": "2026-10-09T08:30:00.000Z",
        "itemCount": 2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-10-09T08:35:00.000Z"
}
```

Khi không có kết quả, `items` là `[]`, `total` và `totalPages` bằng `0`, `hasNextPage` bằng `false`.

### 3.6. Schema item lịch sử

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|:---:|---|
| `id` | string | Có | ID định danh chuẩn của Order (CUID), dùng để điều hướng API chi tiết. |
| `orderNumber` | integer | Có | Mã số đơn hàng tự tăng từ DB (`Order.orderNumber`); UI format `#1042`. |
| `status` | enum string | Có | Trạng thái hiện tại thuộc enum `OrderStatus`. |
| `totalAmount` | integer | Có | Tổng tiền hàng trước giảm giá. |
| `discountAmount` | integer | Có | Số tiền giảm giá (mặc định 0). |
| `finalAmount` | integer | Có | Tiền thực tế thanh toán từ `Order.finalAmount`. |
| `createdAt` | string (ISO-8601) | Có | Thời điểm tạo đơn hàng. |
| `itemCount` | integer | Có | Tổng số lượng ly/món trong đơn hàng (`SUM(quantity)`). |

## 4. API lấy chi tiết đơn hàng

### 4.1. Endpoint

- **Method:** `GET`
- **URL:** `/api/v1/orders/:id`
- **Authentication:** Bắt buộc JWT (`Authorization: Bearer <token>`)
- **Request body:** Không có

`id` phải là ID CUID lấy từ trường `items[n].id` của API lịch sử.

### 4.2. Request

```http
GET /api/v1/orders/cmv5t0qeq0000mq6wzi4wzbl2
Authorization: Bearer <access-token>
Accept: application/json
```

| Path parameter | Kiểu | Bắt buộc | Mô tả |
|---|---|:---:|---|
| `id` | string | Có | ID CUID của Order cần xem chi tiết. |

Backend validate `id`, sau đó truy vấn theo đồng thời `id` và `userId` trong JWT (`order.userId === req.user.sub`). Nếu không tìm thấy hoặc đơn thuộc user khác, trả `404 Not Found` để không làm lộ dữ liệu.

### 4.3. Response thành công

**HTTP status:** `200 OK`

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "cmv5t0qeq0000mq6wzi4wzbl2",
    "orderNumber": 1042,
    "status": "PREPARING",
    "totalAmount": 125000,
    "discountAmount": 0,
    "finalAmount": 125000,
    "createdAt": "2026-10-09T08:30:00.000Z",
    "items": [
      {
        "id": "item_01J8K4QZ",
        "productId": "cmv5p023c0007mq44py7r5lut",
        "name": "Cà phê sữa đá",
        "size": "M",
        "quantity": 2,
        "unitPrice": 40000,
        "lineTotal": 125000,
        "toppings": [
          {
            "id": "oit_01J8K4QZ",
            "toppingId": "cmv5p02340003mq449hok5wj6",
            "name": "Trân châu đen",
            "price": 10000
          }
        ]
      }
    ]
  },
  "timestamp": "2026-10-09T08:36:00.000Z"
}
```

### 4.4. Schema chi tiết

Các trường cấp đơn hàng (`id`, `orderNumber`, `status`, `totalAmount`, `discountAmount`, `finalAmount`, `createdAt`) có quy tắc giống item lịch sử. Trường `items` là mảng các `OrderItem`:

| Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|:---:|---|
| `id` | string | Có | ID của OrderItem (`OrderItem.id`). |
| `productId` | string | Có | ID sản phẩm (`OrderItem.productId`). |
| `name` | string | Có | Tên sản phẩm hiển thị (`Product.name`). |
| `size` | string | Có | Kích thước: `S`, `M`, `L`. |
| `quantity` | integer | Có | Số lượng đặt (`OrderItem.quantity`), tối thiểu 1. |
| `unitPrice` | integer | Có | Đơn giá sản phẩm theo size tại thời điểm đặt. |
| `lineTotal` | integer | Có | Thành tiền dòng món: `(unitPrice + toppings) * quantity`. |
| `toppings` | array | Có | Danh sách topping kèm theo (`OrderItemTopping`). Mảng rỗng nếu không có topping. |
| `toppings[].id` | string | Có | ID bản ghi OrderItemTopping. |
| `toppings[].toppingId` | string | Có | ID topping. |
| `toppings[].name` | string | Có | Tên topping (`Topping.name`). |
| `toppings[].price` | integer | Có | Đơn giá topping tại thời điểm đặt. |

Chi tiết đơn hàng không trả password, token, thông tin thẻ/tài khoản, secret,
`idempotencyKey` hoặc dữ liệu của người dùng khác.

## 5. Ma trận lỗi

| HTTP status | `error` | Trường hợp | `message` quy ước |
|---:|---|---|---|
| `400` | `Bad Request` | Query/path parameter không hợp lệ | Mảng lỗi từ `ValidationPipe`. |
| `401` | `Unauthorized` | Thiếu, sai hoặc hết hạn JWT | `Vui lòng đăng nhập để tiếp tục` |
| `403` | `Forbidden` | Bị từ chối theo policy truy cập | `Bạn không có quyền thực hiện thao tác này` |
| `404` | `Not Found` | Không tồn tại Order hoặc không thuộc user hiện tại | `Không tìm thấy đơn hàng` |
| `500` | `Internal Server Error` | Lỗi không mong muốn ở Backend | `Internal server error` |

Với API chi tiết, ID không tồn tại và ID thuộc tài khoản khác cùng trả `404`
để không làm lộ sự tồn tại của dữ liệu. Không trả `403` có chứa thông tin giúp
Client suy đoán chủ sở hữu Order.

### 5.1. Ví dụ lỗi validation

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "page must not be less than 1",
    "limit must not be greater than 50",
    "status must be a valid enum value"
  ],
  "timestamp": "2026-10-09T08:35:00.000Z",
  "path": "/api/v1/orders/me?page=0&limit=51&status=UNKNOWN"
}
```

### 5.2. Ví dụ lỗi xác thực

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Vui lòng đăng nhập để tiếp tục",
  "timestamp": "2026-10-09T08:35:00.000Z",
  "path": "/api/v1/orders/me"
}
```

## 6. Yêu cầu triển khai và tích hợp

### 6.1. Backend

- Controller dùng `JwtAuthGuard` cho cả hai endpoint.
- Query phải được định nghĩa bằng DTO có decorator `class-validator`; không
  nhận `any` hoặc bỏ qua validation.
- Service phải truyền identity đã xác thực xuống repository và lọc theo
  `userId`.
- Các hàm I/O được triển khai bằng `async/await`; lỗi để exception filter
  chuẩn xử lý, không nuốt lỗi hoặc trả response thành công giả.
- Repository phải có thứ tự phụ ổn định (`id`) khi `createdAt` trùng nhau.
- Không log access token, dữ liệu nhạy cảm hoặc toàn bộ payload không cần thiết.

### 6.2. Frontend

- Gửi `Authorization: Bearer <access-token>`; không gửi `userId`.
- Khi đổi `status`, đặt lại `page=1`; khi tải thêm chỉ tăng page sau khi request
  trước thành công.
- Dùng `hasNextPage` để dừng tải thêm và chống request trùng.
- Phân biệt rõ Loading, Empty, Error và Success; lỗi mạng/`5xx` không được
  hiển thị thành Empty State.
- Với `401`, chỉ refresh token nếu cơ chế refresh đã tồn tại; nếu thất bại thì
  yêu cầu đăng nhập lại và không retry vô hạn.
- Khi mở chi tiết, dùng `id` từ response và tải lại dữ liệu từ Backend; snapshot
  trên card chỉ được dùng làm placeholder.

## 7. Tiêu chí nghiệm thu

- [ ] Người dùng đã xác thực chỉ nhìn thấy Order thuộc tài khoản của mình.
- [ ] Thiếu hoặc không hợp lệ JWT trả `401` theo error envelope chuẩn.
- [ ] `page`, `limit`, `status` được validation bằng DTO; query sai trả `400`
  và không gọi repository.
- [ ] Danh sách được sắp xếp `createdAt DESC`, `id DESC`, phân trang đúng và
  trả đầy đủ metadata.
- [ ] Không có dữ liệu trả `200` với `data: []`, không bị nhầm thành lỗi.
- [ ] API chi tiết kiểm tra `id` và `userId` trong cùng điều kiện truy vấn;
  Order không thuộc user trả `404`.
- [ ] Không trả password, token, thông tin thanh toán bí mật, idempotency key
  hoặc dữ liệu của tài khoản khác.
- [ ] Response thành công/lỗi tuân thủ đúng checklist `TransformInterceptor`
  và `AllExceptionsFilter`.
- [ ] Frontend xử lý Loading, Empty, Error, tải thêm và retry đúng hợp đồng.
- [ ] Backend và Frontend chạy `npm run build` không phát sinh lỗi TypeScript.