# 🧋 ĐẶC TẢ USE CASE — PRODUCT DETAIL (PRODUCT SPECIFICATION)

**Dự án:** BrewLite – Hệ thống đặt cà phê không dùng tiền mặt  
**Phân hệ:** Ordering / Product  
**Tham chiếu hợp đồng API:** `api-contract.md` — bản nháp cập nhật 09/10/2026  
**Trạng thái đồng bộ:** Đồng bộ theo các trường API hiện được đặc tả; các điểm chưa có trong API được ghi rõ là cần nhóm xác nhận.  
**Phạm vi:** Xem chi tiết sản phẩm, chọn size, chọn/bỏ topping theo dữ liệu API hiện có, cập nhật Estimated Price tức thì, kiểm tra khả dụng ở cấp sản phẩm và chuyển cấu hình món sang Cart.  
**Ngoài phạm vi:** Tạo đơn hàng, checkout, Payment Provider và xử lý thanh toán.

---

## 1. TỔNG QUAN PHÂN HỆ (MODULE OVERVIEW)

Product Detail cho phép khách hàng tải thông tin một sản phẩm từ Product API, xem giá và tùy chọn do API cung cấp, chọn size/topping khi có dữ liệu hợp lệ, theo dõi Estimated Price và chuyển cấu hình sang Cart. Product Detail không tạo order và không xử lý thanh toán.

### 1.1. Các ca sử dụng cốt lõi

1. **`UC-PROD-01`**: Xem chi tiết sản phẩm (View Product Detail).
2. **`UC-PROD-02`**: Tùy chỉnh size và topping (Customize Product).
3. **`UC-PROD-03`**: Cập nhật giá ước tính và kiểm tra khả dụng (Update Estimated Price & Check Availability).
4. **`UC-PROD-04`**: Thêm cấu hình sản phẩm vào giỏ hàng (Add Configured Product to Cart).

### 1.2. Actors

| Actor | Mô tả |
| :--- | :--- |
| **Customer** | Xem sản phẩm, chọn size/topping và thêm cấu hình món vào Cart. |
| **Frontend (BrewLite Web)** | Gọi Product API, hiển thị dữ liệu, giữ lựa chọn tạm thời, tính Estimated Price và chuyển payload sang Cart. |
| **Backend (Product API)** | Cung cấp thông tin sản phẩm qua `GET /api/v1/products/:id`; backend là nguồn dữ liệu chuẩn cho giá và trạng thái sản phẩm. |
| **Cart Module** | Nhận payload từ Frontend và cập nhật giỏ hàng. Hợp đồng Cart là giao tiếp nội bộ Frontend, không phải endpoint được định nghĩa trong `api-contract.md`. |

### 1.3. Quy ước đồng bộ API

Các trường trong đặc tả này phải khớp với `api-contract.md`:

- Endpoint: `GET /api/v1/products/:id`.
- Response thành công có wrapper `{ success, statusCode, data, timestamp }`.
- Các trường trong `data`: `id`, `name`, `imageUrl`, `basePrice`, `currency`, `isAvailable`, `sizePrices`, `toppings`.
- `id` là chuỗi CUID; `imageUrl` có thể là `null`.
- `sizePrices[]` hiện có `size` (`S`, `M`, `L`) và `priceAdjustment`.
- `toppings[]` gồm danh sách toàn bộ `Topping` có `isAvailable = true` và `stock > 0`, mỗi phần tử gồm `{ id, name, price }` (Quyết định D3).
- Hợp đồng hiện chưa có `description`, mảng `images`, `sizeId`, `toppingIds` hoặc trạng thái khả dụng riêng cho từng size/topping. Không được giả định các trường này tồn tại trong response hiện tại.
- Trạng thái bán cấp sản phẩm dùng `isAvailable`, ánh xạ từ `Product.isAvailable`; không dùng `status: "available"` trong response theo hợp đồng hiện tại.
- API contract chưa xác định API riêng để kiểm tra tồn kho theo thời gian thực. `Product.stock` tồn tại trong database nhưng chưa được đưa vào response; quy tắc hiển thị hết hàng dựa vào `available` cho đến khi nhóm chốt cách biểu diễn tồn kho.

---

## 2. BẢNG ĐẶC TẢ CHI TIẾT (USE CASE SPECIFICATIONS)

### 📄 UC-PROD-01: XEM CHI TIẾT SẢN PHẨM (VIEW PRODUCT DETAIL)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-PROD-01` |
| **Tên Use Case** | Xem chi tiết sản phẩm |
| **Actor chính** | Khách hàng (Customer) |
| **Actor/phân hệ hỗ trợ** | Frontend, Backend Product API |
| **Mục đích** | Hiển thị dữ liệu chi tiết sản phẩm theo đúng response của Product API. |
| **Điều kiện tiên quyết (Pre-condition)** | Khách hàng mở trang chi tiết với `id` sản phẩm dạng chuỗi. |
| **Điều kiện kết thúc (Post-condition)** | Thành công: dữ liệu hợp lệ được hiển thị. Thất bại: giao diện thể hiện trạng thái lỗi phù hợp và không cho thêm sản phẩm vào Cart bằng dữ liệu không hợp lệ. |

#### Luồng sự kiện chính (Main Flow — Happy Path)

1. Khách hàng chọn một sản phẩm hoặc mở URL chi tiết có `id`.
2. Frontend hiển thị trạng thái loading/skeleton.
3. Frontend gửi `GET /api/v1/products/:id`.
4. Backend tra cứu sản phẩm theo ID và lấy dữ liệu theo hợp đồng hiện tại: `id`, `name`, `imageUrl`, `basePrice`, `currency`, `isAvailable`, `sizePrices`, `toppings`.
5. Backend trả `200 OK` theo wrapper chung: `success: true`, `statusCode: 200`, `data`, `timestamp`.
6. Frontend đọc dữ liệu từ thuộc tính `data` và hiển thị tên, ảnh nếu có, giá gốc, đơn vị tiền, các size, topping và trạng thái `isAvailable`.
7. Nếu `imageUrl` là `null`, Frontend hiển thị ảnh thay thế; không coi đây là lỗi tải Product API.
8. Frontend kiểm tra trạng thái khả dụng của sản phẩm (`isAvailable`):
   - **Nếu `isAvailable === true` (khả dụng):** Cho phép khách hàng xem chi tiết thông tin và chuyển sang `UC-PROD-02` để tùy chỉnh kích cỡ (size) và topping.
   - **Nếu `isAvailable === false` (hết hàng / không còn bán):** Frontend hiển thị thông báo "Sản phẩm không còn bán / Hết hàng", vô hiệu hóa hoàn toàn giao diện tùy chỉnh và khóa thao tác thêm vào giỏ hàng (khớp đúng luồng rẽ nhánh trong `activity-product-detail.puml`).

#### Các luồng thay thế & ngoại lệ (Alternative & Exception Flows)

- **E1 — Không tìm thấy sản phẩm (`404 Not Found`):** Backend trả error response gồm `success: false`, `statusCode: 404`, `error`, `message`, `timestamp`, `path`. Frontend hiển thị thông báo “Không tìm thấy sản phẩm” và không cho thêm vào Cart.
- **E2 — ID sai định dạng (`400 Bad Request`):** Backend trả `400` theo quy ước API. Frontend hiển thị lỗi không thể mở sản phẩm; không tự sửa hoặc đoán ID.
- **E3 — Lỗi hệ thống (`500 Internal Server Error`) hoặc lỗi mạng:** Frontend hiển thị trạng thái không tải được sản phẩm và nút thử lại. Với lỗi HTTP, hiển thị thông báo từ error response theo quy ước giao diện; không giả lập dữ liệu thành công.
- **E4 — Response không đúng hợp đồng:** Nếu thiếu trường bắt buộc như `id`, `name`, `basePrice`, `currency`, `isAvailable`, `sizePrices` hoặc `toppings`, hoặc wrapper sai định dạng, Frontend hiển thị lỗi dữ liệu và khóa thao tác thêm vào Cart.
- **E5 — Sản phẩm không khả dụng (`isAvailable: false`):** Vẫn có thể hiển thị thông tin sản phẩm nhưng phải ghi rõ không khả dụng và vô hiệu hóa thao tác thêm vào Cart.
- **E6 — Không có ảnh (`imageUrl: null`):** Hiển thị ảnh placeholder; các chức năng còn lại vẫn hoạt động nếu dữ liệu cần thiết hợp lệ.

---

### 📄 UC-PROD-02: TÙY CHỈNH SIZE VÀ TOPPING (CUSTOMIZE PRODUCT)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-PROD-02` |
| **Tên Use Case** | Tùy chỉnh size và topping |
| **Actor chính** | Khách hàng (Customer) |
| **Actor/phân hệ hỗ trợ** | Frontend |
| **Mục đích** | Cho phép khách chọn một size trong danh sách API trả về và chọn/bỏ topping nếu response cung cấp cấu trúc topping đủ để xác định lựa chọn và giá. |
| **Điều kiện tiên quyết (Pre-condition)** | `UC-PROD-01` tải thành công; sản phẩm có `isAvailable: true`. |
| **Điều kiện kết thúc (Post-condition)** | Lựa chọn hiện tại được lưu trong state Product Detail để tính Estimated Price. Chưa tạo order. |

#### Luồng sự kiện chính (Main Flow)

1. Frontend hiển thị danh sách `sizePrices[]` lấy từ `data.sizePrices`; mỗi phần tử dùng `size` và `priceAdjustment`.
2. Khách chọn một size (`S`, `M` hoặc `L`) có trong response.
3. Frontend cập nhật size đang chọn; nếu chỉ cho phép một size, lựa chọn mới thay thế lựa chọn cũ.
4. Frontend hiển thị `data.toppings` theo đúng cấu trúc topping đã được nhóm xác nhận trong API contract.
5. Khách chọn hoặc bỏ chọn topping nếu danh sách topping cung cấp ID/định danh ổn định và giá cho mỗi lựa chọn.
6. Frontend cập nhật state lựa chọn và kích hoạt `UC-PROD-03` để tính lại Estimated Price.

#### Các luồng thay thế & ngoại lệ

- **E1 — Không có size:** Nếu `sizePrices` rỗng hoặc không có lựa chọn hợp lệ, Frontend thông báo không có size khả dụng và khóa thêm vào Cart.
- **E2 — Chưa chọn size:** Nếu nghiệp vụ yêu cầu chọn size nhưng chưa có lựa chọn, yêu cầu khách chọn trước khi thêm vào Cart.
- **E3 — Topping không khả dụng:** Nếu sản phẩm không có topping nào khả dụng (`toppings: []` do tất cả topping đều hết hàng), Frontend ẩn phần chọn topping hoặc hiển thị thông báo tạm hết topping.
- **E4 — Tùy chọn không còn trong response mới nhất:** Không gửi lựa chọn cũ không còn hợp lệ sang Cart. Tải lại dữ liệu nếu có thể và yêu cầu khách chọn lại.
- **E5 — Không khả dụng cấp sản phẩm:** Nếu `isAvailable: false`, không cho tiếp tục thêm cấu hình vào Cart.

> **Đã chốt theo Quyết định D3:** Không dùng bảng `ProductTopping`, API trả về toàn bộ `Topping` có `isAvailable = true` và `stock > 0`. Khách hàng có thể chọn bất kỳ topping nào khả dụng.

---

### 📄 UC-PROD-03: CẬP NHẬT ESTIMATED PRICE VÀ KIỂM TRA KHẢ DỤNG

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-PROD-03` |
| **Tên Use Case** | Cập nhật giá ước tính và kiểm tra khả dụng |
| **Actor chính** | Customer (khởi phát qua thao tác chọn size/topping) |
| **Actor/phân hệ hỗ trợ** | Frontend, dữ liệu Product API đã tải |
| **Mục đích** | Cập nhật giá ước tính ngay khi lựa chọn thay đổi và ngăn thêm sản phẩm không khả dụng vào Cart. |
| **Điều kiện tiên quyết (Pre-condition)** | Product API trả dữ liệu hợp lệ, bao gồm `basePrice`, `currency`, `isAvailable` và danh sách `sizePrices`. |
| **Điều kiện kết thúc (Post-condition)** | Estimated Price được cập nhật theo các trường giá đã có; trạng thái thêm vào Cart tuân theo `isAvailable` và tính hợp lệ của lựa chọn. |

#### Luồng sự kiện chính (Main Flow)

1. Frontend lấy `basePrice` và `currency` từ `data`.
2. Frontend xác định `priceAdjustment` từ phần tử `data.sizePrices` tương ứng với size đang chọn.
3. Nếu cấu trúc topping được API contract xác định đầy đủ giá, Frontend cộng giá của các topping đã chọn; nếu không, không tự suy diễn giá topping.
4. Frontend tính và hiển thị Estimated Price ngay khi khách đổi size hoặc chọn/bỏ topping, không tải lại trang.
5. Frontend hiển thị đơn vị tiền theo `currency` (hiện dự kiến `VND`).
6. Frontend kiểm tra `data.isAvailable`. Nếu `false`, hiển thị “Không khả dụng/Hết hàng” và khóa thao tác thêm vào Cart.
7. Frontend chỉ bật thêm vào Cart khi giá tính được và cấu hình hợp lệ.

#### Quy tắc tính giá

Khi đã có dữ liệu đầy đủ theo hợp đồng:

`Estimated Price = basePrice + selectedSize.priceAdjustment + Σ(selected topping prices)`

Với API contract hiện tại, phần giá cơ bản và phụ phí size đã được định nghĩa. Công thức đầy đủ có thể thực thi sau khi schema topping được xác nhận. Không thay giá thiếu/null bằng `0`. Giá này là ước tính cho một món; không phải giá thanh toán chính thức.



#### Các luồng thay thế & ngoại lệ

- **E1 — Sản phẩm không khả dụng:** `data.isAvailable === false` thì hiển thị trạng thái không khả dụng và khóa thêm vào Cart.
- **E2 — Size không thuộc response:** Không tính giá bằng size không tồn tại trong `data.sizePrices`; yêu cầu khách chọn lại từ danh sách hiện hành.
- **E3 — Thiếu hoặc sai dữ liệu giá:** Nếu `basePrice` hoặc `priceAdjustment` không hợp lệ/không thể chuyển đổi an toàn, hiển thị lỗi không thể tính giá và khóa thêm vào Cart.
- **E4 — Topping chưa có giá theo hợp đồng:** Không cộng giá suy đoán. Chỉ cho phép tính giá có topping khi API contract định nghĩa trường giá rõ ràng.
- **E5 — Tồn kho thay đổi:** Hợp đồng hiện tại chỉ trả `isAvailable`, chưa trả `stock` hoặc API kiểm tra tồn kho riêng. Frontend dùng `isAvailable` làm trạng thái được phép bán theo hợp đồng hiện tại; kiểm tra tồn kho chi tiết cần cập nhật API contract trước khi nghiệm thu.

---

### 📄 UC-PROD-04: THÊM CẤU HÌNH SẢN PHẨM VÀO GIỎ HÀNG (ADD CONFIGURED PRODUCT TO CART)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-PROD-04` |
| **Tên Use Case** | Thêm cấu hình sản phẩm vào giỏ hàng |
| **Actor chính** | Khách hàng (Customer) |
| **Actor/phân hệ hỗ trợ** | Frontend Product Detail, Cart Module |
| **Mục đích** | Chuyển cấu hình món hợp lệ sang Cart; không gọi API tạo order. |
| **Điều kiện tiên quyết (Pre-condition)** | Product API tải thành công; `isAvailable: true`; size được chọn hợp lệ; Estimated Price tính được; dữ liệu topping (nếu chọn) hợp lệ theo contract đã thống nhất. |
| **Điều kiện kết thúc (Post-condition)** | Cart nhận payload nội bộ và cập nhật giỏ. Không tạo order, không checkout và không thanh toán. |

#### Luồng sự kiện chính (Main Flow)

1. Khách nhấn “Thêm vào giỏ hàng”.
2. Frontend kiểm tra dữ liệu sản phẩm, `isAvailable`, size được chọn và Estimated Price.
3. Frontend tạo payload Cart theo mapping đã thống nhất giữa Product API và Cart module.
4. Với hợp đồng hiện tại, `productId` lấy từ `data.id`; size được chọn lấy từ `data.sizePrices[].size` (enum `S`, `M`, `L`); `estimatedUnitPrice` là giá ước tính hiển thị; `quantity` mặc định là `1`.
5. Frontend chỉ gửi `toppingIds` khi Cart contract và Product API đã thống nhất định danh topping. Không tự tạo ID từ tên topping.
6. Frontend chuyển payload sang Cart module (giao tiếp nội bộ Frontend; không phải endpoint thuộc `api-contract.md`).
7. Khi Cart xác nhận nhận payload thành công, Frontend cập nhật giao diện giỏ và hiển thị thông báo thành công.

#### Payload chuyển sang Cart (đề xuất nội bộ, không phải API Product)

```json
{
  "productId": "clproduct001",
  "name": "Latte",
  "imageUrl": "/images/latte.jpg",
  "size": "M",
  "toppingIds": [],
  "quantity": 1,
  "estimatedUnitPrice": 45000,
  "currency": "VND"
}
```

**Mapping và giới hạn:**

- `productId` ← `data.id` (string/CUID).
- `name` ← `data.name`.
- `imageUrl` ← `data.imageUrl` (có thể `null`; Cart cần chấp nhận null hoặc Frontend dùng placeholder chỉ cho hiển thị).
- `size` ← `data.sizePrices[].size`; không gọi trường này là `sizeId` vì API chưa cung cấp ID size.
- `toppingIds` chỉ dùng khi định danh topping được thống nhất; response hiện tại chưa mô tả trường ID của topping.
- `estimatedUnitPrice` là giá ước tính hiển thị, không phải giá được bảo đảm để thanh toán.
- `currency` ← `data.currency`.
- Đây là payload đề xuất cho Cart module, không phải request body của endpoint backend trong `api-contract.md`.

#### Các luồng thay thế & ngoại lệ

- **E1 — Thiếu size hoặc cấu hình sai:** Không gửi payload; yêu cầu khách sửa lựa chọn.
- **E2 — Sản phẩm không khả dụng:** Nếu `isAvailable: false`, không chuyển payload sang Cart.
- **E3 — Không tính được giá:** Không gửi payload có giá mặc định `0`; hiển thị lỗi và cho phép tải lại dữ liệu.
- **E4 — Topping không thể ánh xạ:** Nếu người dùng chọn topping nhưng API chưa cung cấp định danh/giá theo contract, không gửi payload không đầy đủ; yêu cầu cập nhật contract hoặc bỏ lựa chọn topping.
- **E5 — Cart không nhận payload:** Hiển thị lỗi, giữ lựa chọn hiện tại và cho phép thử lại; không hiển thị thông báo thành công giả.
- **E6 — Bấm nhiều lần:** Khóa nút trong lúc Cart đang xử lý hoặc áp dụng cơ chế chống lặp ở Cart để tránh thêm ngoài ý muốn.

---

## 3. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)

1. **`BR-PROD-01` — Ranh giới feature:** Product Detail chỉ xem, tùy chỉnh, tính giá ước tính, kiểm tra khả dụng cấp sản phẩm và chuyển cấu hình sang Cart. Không tạo order hoặc thanh toán.
2. **`BR-PROD-02` — Nguồn dữ liệu sản phẩm:** Dùng `GET /api/v1/products/:id`; đọc dữ liệu sản phẩm trong `data` của success wrapper.
3. **`BR-PROD-03` — Giá:** `basePrice` lấy từ `Product.basePrice`; phụ phí size lấy từ `sizePrices[].priceAdjustment`; giá topping chỉ dùng khi topping schema/contract định nghĩa rõ.
4. **`BR-PROD-04` — Cập nhật tức thì:** Mỗi lần đổi size/topping, Frontend tính lại Estimated Price không cần tải lại trang.
5. **`BR-PROD-05` — Trạng thái bán (Quyết định 5):** Dùng trường API `isAvailable`, được Backend tính toán bằng `(Product.isAvailable && Product.stock > 0)`. Không trả trường `stock` ra ngoài API. Nếu `isAvailable === false` (hết hàng hoặc ngừng bán), sản phẩm vẫn hiển thị thông tin nhưng hiện badge "Hết hàng" và khóa thao tác thêm vào giỏ hàng.
6. **`BR-PROD-06` — Giá không hợp lệ:** Không thay giá thiếu/null hoặc không parse được bằng `0`; khóa thao tác thêm vào Cart cho đến khi dữ liệu hợp lệ.
7. **`BR-PROD-07` — ID và payload:** `productId` là string/CUID. API hiện không cung cấp `sizeId`; trường size hiện là enum `S`, `M`, `L`. Không tự tạo `toppingIds` nếu chưa có định danh topping trong contract.
8. **`BR-PROD-08` — Giá ước tính:** `estimatedUnitPrice` chỉ phục vụ hiển thị trong Cart. Backend phải xác thực giá từ nguồn tin cậy trước khi tạo đơn theo phạm vi của feature khác.
9. **`BR-PROD-09` — Topping và tồn kho chi tiết:** Quan hệ Product–Topping, schema phần tử `toppings[]`, trạng thái khả dụng riêng của size/topping và cách sử dụng `Product.stock` cần nhóm thống nhất trước khi coi là yêu cầu đã chốt.

---

### 3.1. BẢNG QUY TẮC TÍNH GIÁ (PRICING RULES)

#### Công thức

```
unitPrice = basePrice + priceAdjustment(size) + Σ giá topping
Thành tiền = (basePrice + priceAdjustment(size) + Σ giá topping) × quantity
```

- `basePrice`: Giá gốc, lấy từ `Product.basePrice` (nguồn: `seed.ts`).
- `priceAdjustment(size)`: Phụ phí theo kích cỡ, lấy từ `ProductSizePrice.priceAdjustment`.
- `Σ giá topping`: Tổng giá các topping được chọn (xem lưu ý blocker bên dưới).
- Không làm tròn số; Prisma dùng kiểu `Decimal` — tránh mất độ chính xác khi chuyển sang `number`.
- `unitPrice` trên là giá cho **1 sản phẩm** với cấu hình đã chọn.
- Thành tiền = `unitPrice × quantity`.

#### Bảng phụ phí Size (từ `backend/prisma/seed.ts`, áp dụng cho **tất cả sản phẩm**)

| Size | `priceAdjustment` |
|------|-------------------|
| S    | +0 đ              |
| M    | +5.000 đ          |
| L    | +10.000 đ         |

#### Bảng giá Topping (từ `backend/prisma/seed.ts`)

| Topping            | Giá topping |
|--------------------|-------------|
| Trân châu trắng    | 5.000 đ     |
| Kem Cheese         | 10.000 đ    |
| Đào miếng          | 8.000 đ     |

#### Ví dụ Input/Output (sử dụng sản phẩm "Cà phê sữa đá", basePrice = 35.000 đ)

| # | Input: Size | Input: Topping(s) | Input: Số lượng (`quantity`) | Công thức tính chi tiết | Đơn giá (`unitPrice`) | Thành tiền (`lineTotal`) |
|---|-------------|-------------------|:---:|-------------------|:---:|:---:|
| 1 | S | Không có | 1 | (35.000 + 0 + 0) × 1 | **35.000 đ** | **35.000 đ** |
| 2 | M | Không có | 2 | (35.000 + 5.000 + 0) × 2 | **40.000 đ** | **80.000 đ** |
| 3 | L | Trân châu trắng (5.000 đ) | 1 | (35.000 + 10.000 + 5.000) × 1 | **50.000 đ** | **50.000 đ** |
| 4 | M | Kem Cheese (10.000 đ) + Đào miếng (8.000 đ) | 2 | (35.000 + 5.000 + 10.000 + 8.000) × 2 | **58.000 đ** | **116.000 đ** |
| 5 | S | Kem Cheese (10.000 đ) | 1 | (35.000 + 0 + 10.000) × 1 | **45.000 đ** | **45.000 đ** |
| 6 | L | Trân châu trắng (5.000 đ) + Kem Cheese (10.000 đ) | 3 | (35.000 + 10.000 + 5.000 + 10.000) × 3 | **60.000 đ** | **180.000 đ** |

> **Lưu ý:** Ví dụ #3–6 có topping áp dụng chính thức theo Quyết định D3 (Topping có sẵn từ seed: Trân châu trắng 5.000 đ, Kem Cheese 10.000 đ, Đào miếng 8.000 đ).

#### Quy tắc làm tròn

Chưa xác định. `seed.ts` dùng đơn vị đồng nguyên (VND không có phần thập phân thực tế). Đề xuất: không làm tròn; hiển thị số nguyên. **ĐỀ XUẤT – cần nhóm xác nhận.**

---


## 4. HỢP ĐỒNG API VÀ PAYLOAD (API CONTRACT & SAMPLES)

### 4.1. Lấy chi tiết sản phẩm — `GET /api/v1/products/:id`

| Thành phần | Đặc tả theo `api-contract.md` |
| :--- | :--- |
| **Method / Endpoint** | `GET /api/v1/products/:id` |
| **Path parameter** | `id: string` (CUID) |
| **Success** | `200 OK` |
| **ID sai định dạng** | `400 Bad Request` |
| **Không tìm thấy** | `404 Not Found` |
| **Lỗi hệ thống** | `500 Internal Server Error` |
| **Content type** | `application/json` |
| **Xác thực** | Chờ nhóm xác nhận |

#### Response thành công (ví dụ theo API contract)

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "cmv19kpye000794rc6vgebmpz",
    "name": "Cà phê sữa đá",
    "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
    "basePrice": 35000,
    "currency": "VND",
    "isAvailable": true,
    "sizePrices": [
      { "size": "S", "priceAdjustment": 0 },
      { "size": "M", "priceAdjustment": 5000 },
      { "size": "L", "priceAdjustment": 10000 }
    ],
    "toppings": [
      {
        "id": "cmv19top000194rc6vgebmp1",
        "name": "Trân châu trắng",
        "price": 5000
      },
      {
        "id": "cmv19top000294rc6vgebmp2",
        "name": "Kem Cheese",
        "price": 10000
      },
      {
        "id": "cmv19top000394rc6vgebmp3",
        "name": "Đào miếng",
        "price": 8000
      }
    ]
  },
  "timestamp": "2026-10-13T08:39:03.235Z"
}
```

Dữ liệu minh họa; danh sách size, giá và topping lấy từ CSDL thực tế (Quyết định D3). `imageUrl` có thể là `null`. Response hiện không có `description`, `images[]`, `status`, `sizeId`, `stock` hoặc trường `isAvailable` riêng cho từng size/topping.

#### Response lỗi

`404 Not Found`:

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Không tìm thấy sản phẩm",
  "timestamp": "2026-10-09T14:00:00.000Z",
  "path": "/api/v1/products/clproduct001"
}
```

`500 Internal Server Error`:

```json
{
  "success": false,
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Đã xảy ra lỗi không mong muốn",
  "timestamp": "2026-10-09T14:00:00.000Z",
  "path": "/api/v1/products/clproduct001"
}
```

Lỗi `400` áp dụng khi ID sai định dạng theo API contract. Error response cần tuân theo format chung của nhóm.

### 4.2. Tích hợp Frontend với Cart

`api-contract.md` nêu rõ Product API không xử lý thêm sản phẩm vào giỏ. Vì vậy payload ở UC-PROD-04 là **hợp đồng nội bộ Frontend/Cart đề xuất**, không được mô tả như endpoint backend đã tồn tại. Các trường và quy tắc gộp dòng hàng cần đồng bộ tiếp với tài liệu Cart.

---

## 5. ACCEPTANCE CRITERIA (ACCEPTANCE TESTS)

| ID | Given (Điều kiện) | When (Thao tác) | Then (Kết quả mong đợi) |
| :--- | :--- | :--- | :--- |
| **AC-PROD-01** | ID là CUID hợp lệ và API trả response đúng contract | Khách mở trang chi tiết | Frontend đọc `data` từ success wrapper và hiển thị `name`, `imageUrl`, `basePrice`, `currency`, `isAvailable`, `sizePrices`, `toppings`. |
| **AC-PROD-02** | Request đang chạy | Khách mở trang | Hiển thị loading/skeleton; chưa cho thêm vào Cart. |
| **AC-PROD-03** | Sản phẩm không tồn tại | API trả `404` theo error wrapper | Hiển thị “Không tìm thấy sản phẩm”; không cho thêm vào Cart. |
| **AC-PROD-04** | ID sai định dạng | API trả `400` | Hiển thị lỗi không thể mở sản phẩm; không tự sửa ID. |
| **AC-PROD-05** | API trả `500` hoặc request gặp lỗi mạng | Request thất bại | Hiển thị lỗi tải và nút thử lại; không giả lập dữ liệu thành công. |
| **AC-PROD-06** | `imageUrl` là `null` | Trang chi tiết được hiển thị | Hiển thị placeholder ảnh; dữ liệu còn lại vẫn có thể sử dụng. |
| **AC-PROD-07** | `sizePrices` có các lựa chọn hợp lệ | Khách chọn size khác | State size được cập nhật theo `sizePrices[].size`; Estimated Price thay đổi theo `priceAdjustment`. |
| **AC-PROD-08** | Có `basePrice` và `priceAdjustment` hợp lệ | Khách thay đổi size | Giá ước tính cập nhật tức thì, không tải lại trang. |
| **AC-PROD-09** | `toppings[]` có schema/giá đã được nhóm xác nhận | Khách chọn hoặc bỏ topping | State topping thay đổi và giá ước tính cập nhật đúng theo giá topping. |
| **AC-PROD-10** | `toppings[]` chưa có định danh/giá rõ ràng | Khách mở tùy chọn topping | Frontend không tự tạo ID/giá; không cho gửi cấu hình topping không thể ánh xạ sang Cart. |
| **AC-PROD-11** | API trả `isAvailable: false` | Khách mở Product Detail hoặc bấm thêm | Hiển thị không khả dụng và không chuyển payload sang Cart. |
| **AC-PROD-12** | `basePrice` hoặc `priceAdjustment` thiếu/sai định dạng | Frontend tính Estimated Price | Hiển thị lỗi tính giá; không mặc định giá bằng `0` và khóa thêm vào Cart. |
| **AC-PROD-13** | Cấu hình hợp lệ và `isAvailable: true` | Khách bấm thêm vào Cart | Cart nhận `productId` từ `data.id`, size theo enum từ `data.sizePrices[].size`, `quantity: 1`, `estimatedUnitPrice` và `currency`. |
| **AC-PROD-14** | Topping được chọn và định danh đã được thống nhất | Frontend tạo payload Cart | Chỉ gửi ID topping hợp lệ; không suy ra ID từ tên. |
| **AC-PROD-15** | Cart xác nhận đã nhận payload | Thao tác thêm hoàn tất | Cập nhật giao diện Cart và hiển thị thành công; không tạo order hoặc gọi Payment Provider. |
| **AC-PROD-16** | Cart từ chối hoặc không xử lý payload | Khách thêm món | Hiển thị lỗi, giữ lựa chọn và cho phép thử lại; không thông báo thành công giả. |
| **AC-PROD-17** | Đang xử lý thao tác thêm | Khách bấm nút nhiều lần | Nút được khóa hoặc Cart chống lặp theo cơ chế đã thống nhất. |
| **AC-PROD-18** | Response thành công có wrapper chung | Frontend xử lý phản hồi | Đọc đúng `success`, `statusCode`, `data`, `timestamp`; không coi payload dữ liệu trực tiếp là response đúng contract. |

---

## 6. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

1. **`NFR-PROD-01` — Hiệu năng:** API Product Detail nên phản hồi dưới 2 giây trong điều kiện vận hành bình thường.
2. **`NFR-PROD-02` — Trạng thái giao diện:** Loading, not-found, unavailable và error state phải được thể hiện rõ.
3. **`NFR-PROD-03` — Tính nhất quán giá:** Estimated Price phải được tính lại mỗi khi size/topping thay đổi; không coi giá ước tính là giá thanh toán chính thức.
4. **`NFR-PROD-04` — Xử lý ảnh:** Frontend phải xử lý `imageUrl: null`.
5. **`NFR-PROD-05` — Kiểu dữ liệu:** Thống nhất xử lý `basePrice` và `priceAdjustment` khi Prisma dùng `Decimal`; không làm tròn hoặc ép kiểu gây sai giá.
6. **`NFR-PROD-06` — Ranh giới feature:** Product Detail chỉ chuyển cấu hình sang Cart; không tích hợp Payment Provider và không tạo/xác nhận đơn hàng.

---

## 7. CÁC ĐIỂM CẦN XÁC NHẬN TRƯỚC KHI CHỐT CONTRACT

Các điểm sau được ghi nhận trong `api-contract.md`:

1. **Topping schema:** Đã chốt theo Quyết định D3 — Topping khả dụng gồm `{ id, name, price }` lấy từ bảng `Topping` với `isAvailable = true` và `stock > 0`.
2. **Mô tả sản phẩm:** `Product` hiện chưa có `description`; không đưa trường này vào response cho đến khi schema/nguồn dữ liệu được thống nhất.
3. **Tồn kho:** Đã được chốt theo Quyết định 5 của Nhóm trưởng — Tuyệt đối không trả `stock` ra ngoài API; Backend tự động tính `isAvailable = (Product.isAvailable && stock > 0)`. Frontend hiển thị hết hàng khi `isAvailable === false`.
4. **Khả dụng size/topping:** Response chưa có `available` riêng cho từng size/topping. Không thể nghiệm thu trạng thái hết hàng riêng từng lựa chọn cho đến khi contract bổ sung.
5. **Payload Cart:** API Product không xử lý Cart. Tên trường payload, định danh size/topping và quy tắc gộp dòng hàng phải được đồng bộ với tài liệu Cart.
6. **Xác thực:** Trạng thái yêu cầu xác thực cho `GET /api/v1/products/:id` đang chờ nhóm xác nhận.

---

## 8. GIẢ ĐỊNH / CÂU HỎI MỞ

### [Q1] Số lượng Topping tối đa mỗi lần đặt

**Đã chốt**:
- Thống nhất: **tối đa 3 topping** mỗi item (khớp với số lượng topping trong seed hiện tại gồm 3 loại: Trân châu trắng, Kem Cheese, Đào miếng).
- Hệ quả: Áp dụng validation `@ArrayMaxSize(3)` vào `CreateOrderItemDto` của Order module và Cart module, đồng thời chặn trên giao diện Product Detail / Cart khi người dùng đã chọn đủ 3 topping.

### [Q2] Cho phép chọn cùng một Topping nhiều lần không?

**Đã chốt**:
- Thống nhất: **không cho chọn trùng** (mỗi loại topping chỉ chọn tối đa 1 lần trên mỗi ly đồ uống).
- Hệ quả: `toppingIds` phải là mảng các ID unique, được kiểm tra bằng `@ArrayUnique()` trong DTO và UI dùng checkbox (bật/tắt) cho từng loại topping.

### [Q3] Quan hệ Product–Topping

**Đã chốt (Quyết định D3)**:
- Không làm bảng `ProductTopping`. `GET /api/v1/products/:id` trả về danh sách `toppings: [{ id, name, price }]` gồm toàn bộ Topping có `isAvailable = true` và `stock > 0` (price là number, không trả stock).
- Khách hàng có thể chọn bất kỳ topping khả dụng nào cho đồ uống.
- Trừ kho Topping trong đơn hàng dùng cập nhật có điều kiện `stock >= qty` (Topping không có cột `version`).

### [Q4] Quy tắc làm tròn giá

**ĐỀ XUẤT – cần nhóm xác nhận.**

- `seed.ts` dùng đơn vị VND nguyên (không có phần thập phân thực tế).
- Đề xuất: **không làm tròn**; hiển thị số nguyên đồng.
- Nếu có khuyến mãi theo % trong tương lai, cần chốt rule làm tròn (ví dụ: làm tròn lên đến hàng nghìn đ).

---
> *Tài liệu cập nhật v1.1 – áp dụng quyết định D3, D5 (ngày 2026-10-16).*