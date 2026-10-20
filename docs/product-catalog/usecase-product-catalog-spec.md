# 🔐 ĐẶC TẢ USE CASE MENU SẢN PHẨM (PRODUCT CATALOG)
### Tác giả: Đinh Nhật Lan (Owner Feature: Product Catalog)
**Dự án:** BrewLite – Hệ Thống Đặt Cà Phê Không Dùng Tiền Mặt  
**Môn học:** Công nghệ Phần mềm | **Học kỳ:** I – 2026–2027  
**Phạm vi:** Đáp ứng Task 6 (Menu sản phẩm): Đặc tả chức năng xem menu, chức năng tìm kiếm và lọc sản phẩm

---

## 1. TỔNG QUAN PHÂN HỆ (MODULE OVERVIEW)
Phân hệ Danh mục sản phẩm (Product Catalog) chịu trách nhiệm cung cấp danh sách đồ uống để khách hàng xem menu, tìm kiếm và lọc sản phẩm theo các tiêu chí được hệ thống hỗ trợ. Phân hệ lấy dữ liệu sản phẩm từ Backend thông qua API `GET /api/v1/products` và hiển thị thông tin tương ứng trên giao diện người dùng.

* **Các ca sử dụng cốt lõi:**
  1. **`UC-CAT-01`**: Xem menu sản phẩm (View Menu).
  2. **`UC-CAT-02`**: Tìm kiếm sản phẩm theo tên (Search Products).
  3. **`UC-CAT-03`**: Lọc sản phẩm theo danh mục (Filter Products by Category).

---

## 2. BẢNG ĐẶC TẢ CHI TIẾT (USE CASE SPECIFICATIONS)

### 📄 UC-CAT-01: XEM MENU SẢN PHẨM (VIEW MENU)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-CAT-01` |
| **Tên Use Case** | Xem menu sản phẩm |
| **Actor chính** | Khách hàng (Customer) |
| **Mục đích** | Xem danh sách sản phẩm đang được mở bán và còn hàng |
| **Điều kiện tiên quyết (Pre-condition)** | Người dùng đang mở ứng dụng web BrewLite |
| **Điều kiện kết thúc (Post-condition)** | Danh sách sản phẩm phù hợp được hiển thị trên giao diện Menu |

#### Luồng sự kiện chính (Main Flow - Happy Path):
1. Khách hàng truy cập trang chủ và chọn chức năng **Khám phá thực đơn** (hoặc điều hướng đến route `/menu`).
2. Hệ thống điều hướng đến trang Menu.
3. Frontend hiển thị trạng thái đang tải dữ liệu (Loading Skeleton).
4. Frontend gọi API `GET /api/v1/products` đến Backend.
5. Backend nhận yêu cầu, truy vấn CSDL để lấy các sản phẩm thỏa mãn điều kiện `isAvailable = true` và `stock > 0`.
6. Backend trả về danh sách sản phẩm theo hợp đồng API chuẩn bọc qua `TransformInterceptor`.
7. Frontend nhận dữ liệu, trích xuất danh sách danh mục (Category tabs) theo thứ tự xuất hiện, và hiển thị danh sách sản phẩm bằng các `ProductCard`.
8. Khách hàng xem thông tin sản phẩm trên menu (tên, ảnh, giá gốc, nhãn danh mục, phụ thu kích cỡ).

#### Các luồng thay thế & ngoại lệ (Alternative & Exception Flows):
* **A1 – Chưa có sản phẩm mở bán:**
  Tại bước 6, nếu Backend trả về mảng `data` rỗng (`[]`), Frontend hiển thị giao diện danh sách rỗng (Empty State) thông báo quán chưa mở bán món nào thay vì hiển thị lỗi.
* **E1 – Lỗi tải dữ liệu:**
  Tại bước 4 hoặc bước 5, nếu yêu cầu lấy dữ liệu thất bại do lỗi mạng hoặc Backend phản hồi lỗi HTTP 500, Frontend hiển thị thông báo lỗi kết nối kèm nút bấm **Thử lại** (`Retry`).

---

### 📄 UC-CAT-02: TÌM KIẾM SẢN PHẨM THEO TÊN (SEARCH PRODUCTS)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-CAT-02` |
| **Tên Use Case** | Tìm kiếm sản phẩm theo tên (Search Products) |
| **Actor chính** | Khách hàng (Customer) |
| **Mục đích** | Giúp khách hàng tìm nhanh sản phẩm theo từ khóa tên món |
| **Pre-condition** | Khách hàng đang ở trang Menu và danh sách sản phẩm đã được tải thành công |
| **Post-condition** | Danh sách sản phẩm trên màn hình được cập nhật theo từ khóa tìm kiếm |

#### Luồng sự kiện chính (Main Flow):
1. Khách hàng nhập từ khóa vào ô tìm kiếm trên trang Menu.
2. Frontend tiếp nhận từ khóa theo thời gian thực (hỗ trợ debounce).
3. Hệ thống chuẩn hóa từ khóa: cắt bỏ khoảng trắng thừa đầu cuối, chuyển về chữ thường, và chuẩn hóa bỏ dấu tiếng Việt (ví dụ: "ca phe" hay "cà phê" đều khớp).
4. Frontend lọc trực tiếp (client-side) trên danh sách sản phẩm đã tải, so sánh từ khóa với tên sản phẩm đã chuẩn hóa bỏ dấu.
5. Frontend kết hợp đồng thời với điều kiện lọc danh mục hiện tại (nếu có).
6. Hệ thống hiển thị danh sách các thẻ sản phẩm phù hợp.
7. Khách hàng xem kết quả tìm kiếm.

#### Các luồng thay thế & ngoại lệ (Alternative & Exception Flows):
* **A1 – Không tìm thấy sản phẩm phù hợp:**
  Tại bước 4, nếu không có món nào thỏa mãn từ khóa, Frontend hiển thị trạng thái "Không tìm thấy kết quả" kèm gợi ý thử từ khóa khác hoặc nút "Xóa bộ lọc".
* **A2 – Xóa từ khóa tìm kiếm:**
  Tại bước 1, khi khách hàng xóa sạch ô tìm kiếm, Frontend tự động hiển thị lại danh sách sản phẩm theo bộ lọc danh mục hiện tại.

---

### 📄 UC-CAT-03: LỌC SẢN PHẨM THEO DANH MỤC (FILTER PRODUCTS BY CATEGORY)

| Thuộc tính | Chi tiết đặc tả |
| :--- | :--- |
| **Mã Use Case** | `UC-CAT-03` |
| **Tên Use Case** | Lọc sản phẩm theo danh mục (Filter Products by Category) |
| **Actor** | Khách hàng (Customer) |
| **Mục đích** | Giúp khách hàng nhanh chóng duyệt các món thuộc nhóm đồ uống mong muốn |
| **Pre-condition** | Khách hàng đang ở trang Menu và danh sách sản phẩm đã được tải thành công |
| **Post-condition** | Danh sách sản phẩm được cập nhật theo tab danh mục được chọn |

#### Luồng sự kiện chính (Main Flow):
1. Frontend hiển thị thanh danh mục gồm tab "Tất cả", tiếp theo là các tab danh mục trích xuất từ dữ liệu món (ví dụ: "Cà phê", "Trà & Trái cây"), và tab "Khác" (nếu có món không có danh mục).
2. Khách hàng nhấn chọn một tab danh mục.
3. Frontend kích hoạt trạng thái được chọn (Active Tab) cho danh mục đó.
4. Frontend lọc danh sách món: chỉ giữ lại các sản phẩm có `categoryName` trùng với tab được chọn (hoặc `categoryName == null` nếu chọn tab "Khác").
5. Frontend kết hợp đồng thời với từ khóa tìm kiếm hiện tại (nếu có).
6. Hệ thống cập nhật danh sách thẻ sản phẩm hiển thị trên màn hình.
7. Khách hàng duyệt các món trong danh mục.

#### Các luồng thay thế & ngoại lệ (Alternative & Exception Flows):
* **A1 – Khách hàng chọn tab "Tất cả":**
  Tại bước 2, khi khách hàng chọn "Tất cả", Frontend loại bỏ điều kiện lọc danh mục và hiển thị toàn bộ sản phẩm (vẫn áp dụng từ khóa tìm kiếm nếu có).
* **A2 – Danh mục không có món thỏa mãn từ khóa:**
  Tại bước 5, nếu trong danh mục được chọn không có món nào khớp với từ khóa tìm kiếm hiện tại, Frontend hiển thị thông báo danh sách trống kèm nút xóa tìm kiếm.

---

## 3. QUY TẮC NGHIỆP VỤ & BẢO MẬT (BUSINESS RULES)

| Mã quy tắc | Tên quy tắc | Nội dung chi tiết |
| :--- | :--- | :--- |
| **BR-CAT-01** | Trạng thái mở bán & Tồn kho | API `GET /api/v1/products` chỉ trả về các sản phẩm thỏa mãn điều kiện kép: `isAvailable = true` VÀ `stock > 0` trong CSDL. Backend tính toán trả về cờ `isAvailable: true`. Tuyệt đối không trả trường `stock` ra ngoài API để bảo mật thông tin tồn kho kinh doanh. |
| **BR-CAT-02** | Thứ tự sắp xếp mặc định | Danh sách sản phẩm trả về từ Backend mặc định được sắp xếp theo tên sản phẩm tăng dần theo bảng chữ cái (A-Z). |
| **BR-CAT-03** | Tìm kiếm không phân biệt dấu và hoa thường | Chức năng tìm kiếm thực hiện tại Client-side. Hệ thống chuẩn hóa cả từ khóa và tên sản phẩm: chuyển thành chữ thường, loại bỏ khoảng trắng thừa, và chuyển đổi ký tự tiếng Việt có dấu thành không dấu (ví dụ: `cà phê` ➔ `ca phe`). Người dùng gõ có dấu hay không dấu đều tìm thấy sản phẩm chính xác. |
| **BR-CAT-04** | Tự động sinh Category Tabs | Frontend tự động trích xuất danh sách các `categoryName` duy nhất (distinct) từ danh sách sản phẩm nhận được từ API. Thứ tự hiển thị các tab danh mục tuân theo thứ tự xuất hiện đầu tiên của từng danh mục trong danh sách. Nếu có sản phẩm không thuộc danh mục nào (`categoryName = null`), hệ thống gom vào tab "Khác". |
| **BR-CAT-05** | Xử lý dữ liệu Client-side (Zero Query Params) | Phiên bản MVP xử lý toàn bộ tìm kiếm và lọc danh mục tại Client-side, không gửi query parameters (`?search=`, `?category=`) lên Backend và không phân trang (Pagination). Quy mô menu cà phê hiện tại (~20–50 món) được tải một lần duy nhất giúp phản hồi tức thì và giảm tải server. Đánh giá lại cơ chế phân trang phía Server khi quy mô thực đơn vượt quá 100 món. |
| **BR-CAT-06** | Độc lập giữa tìm kiếm và lọc | Khi người dùng chuyển đổi qua lại giữa các tab danh mục, từ khóa tìm kiếm trong ô nhập liệu vẫn được giữ nguyên để lọc kết hợp. Ngược lại, khi xóa từ khóa, danh mục đang chọn vẫn được bảo lưu. |
| **BR-CAT-07** | Bảo mật API & Dữ liệu mở | Endpoint `GET /api/v1/products` là API công khai (Public API), không yêu cầu Header xác thực (`Authorization`) để bất kỳ khách hàng nào cũng có thể duyệt thực đơn. |

---

## 4. TIÊU CHÍ CHẤP NHẬN (ACCEPTANCE CRITERIA)

### AC-CAT-01: Hiển thị danh sách sản phẩm hợp lệ
* **Điều kiện:** Khách hàng truy cập trang Menu (`/menu`).
* **Hành động:** Frontend gọi `GET /api/v1/products` thành công.
* **Kết quả mong đợi:**
  * Chỉ các món có `isAvailable = true` và `stock > 0` mới xuất hiện trên giao diện.
  * Mỗi sản phẩm hiển thị đầy đủ: tên (`name`), ảnh (`imageUrl`), giá cơ bản (`basePrice`), tên danh mục (`categoryName`), và các mức giá phụ thu size (`sizePrices`).
  * Danh sách được sắp xếp theo tên tăng dần.

### AC-CAT-02: Tìm kiếm sản phẩm linh hoạt (hỗ trợ tiếng Việt không dấu)
* **Điều kiện:** Danh sách sản phẩm đã được tải về giao diện.
* **Hành động:** Khách hàng gõ từ khóa vào ô tìm kiếm (ví dụ gõ "tra dao" hoặc "Trà Đào").
* **Kết quả mong đợi:**
  * Hiển thị sản phẩm "Trà đào cam sả".
  * Không phân biệt hoa/thường, không phân biệt dấu tiếng Việt.
  * Khoảng trắng thừa ở đầu/cuối từ khóa tự động được loại bỏ.

### AC-CAT-03: Lọc danh mục tự động và tab "Khác"
* **Điều kiện:** Danh sách sản phẩm đã tải thành công.
* **Hành động:** Khách hàng bấm chọn một tab danh mục trên thanh điều hướng.
* **Kết quả mong đợi:**
  * Chọn tab cụ thể: chỉ các món có `categoryName` tương ứng hiển thị.
  * Chọn tab "Khác": chỉ các món có `categoryName = null` hiển thị.
  * Chọn tab "Tất cả": hiển thị lại toàn bộ sản phẩm.

### AC-CAT-04: Kết hợp đồng thời bộ lọc và tìm kiếm
* **Điều kiện:** Đang chọn danh mục "Cà phê".
* **Hành động:** Khách hàng nhập từ khóa "sua".
* **Kết quả mong đợi:**
  * Chỉ hiển thị các món vừa thuộc nhóm "Cà phê" vừa có tên chứa "sữa" (ví dụ: "Cà phê sữa đá").

---

## 5. MÔ TẢ GIAO DIỆN VÀ CÁC TRẠNG THÁI UI (UI COMPONENT STATES)

> **Ghi chú quyết định nhóm:** Tiêu chí Wireframe/Figma trực quan được **miễn trừ ở Tuần 1** theo quyết định của Nhóm trưởng. Giao diện được đặc tả chi tiết thông qua các trạng thái thành phần giao diện (Component States) dưới đây:

### 5.1. Trạng thái Đang tải (Loading State)
* **Khi nào xuất hiện:** Khi người dùng mở trang Menu và API `GET /api/v1/products` đang trong quá trình tải.
* **Giao diện thể hiện:**
  * Hiển thị khung xương (Skeleton Loader) dạng lưới 4 cột (desktop) hoặc 2 cột (mobile).
  * Mỗi thẻ skeleton có hiệu ứng chuyển động sáng mờ (shimmer animation), mô phỏng vị trí ảnh (tỷ lệ 1:1), dòng tiêu đề tên món và dòng giá tiền.
  * Thanh tìm kiếm và các tab danh mục ở trạng thái vô hiệu hóa tạm thời (disabled).

### 5.2. Trạng thái Danh sách thực đơn rỗng (Empty Menu State)
* **Khi nào xuất hiện:** Khi Backend phản hồi thành công (`200 OK`) nhưng trường `data` là mảng rỗng (`[]`) do quán chưa mở bán món nào.
* **Giao diện thể hiện:**
  * Vùng nội dung chính ẩn lưới thẻ sản phẩm.
  * Hiển thị hình minh họa cốc cà phê trống.
  * Dòng chữ thông báo: *"Hiện chưa có sản phẩm nào được mở bán. Vui lòng quay lại sau!"*
  * Không hiển thị thông báo lỗi kỹ thuật hay nút thử lại.

### 5.3. Trạng thái Không có kết quả tìm kiếm/lọc (No Search/Filter Results State)
* **Khi nào xuất hiện:** Danh sách món có dữ liệu, nhưng không có món nào thỏa mãn từ khóa tìm kiếm hoặc danh mục đang chọn.
* **Giao diện thể hiện:**
  * Hiển thị biểu tượng kính lúp không có kết quả.
  * Tiêu đề: *"Không tìm thấy món phù hợp"*
  * Mô tả: *"Không có sản phẩm nào khớp với từ khóa '**{keyword}**' trong danh mục '**{category}**'."*
  * Nút bấm hành động: *"Xóa bộ lọc"* (Click vào sẽ reset ô tìm kiếm và chuyển tab về "Tất cả").

### 5.4. Trạng thái Lỗi kết nối (Error State)
* **Khi nào xuất hiện:** Khi gọi API thất bại (lỗi mạng, server offline, mã lỗi HTTP 500).
* **Giao diện thể hiện:**
  * Hiển thị biểu tượng cảnh báo hình tam giác màu cam.
  * Tiêu đề: *"Không thể tải thực đơn"*
  * Mô tả: *"Đã có lỗi xảy ra trong quá trình lấy danh sách sản phẩm. Vui lòng kiểm tra lại kết nối mạng."*
  * Nút bấm hành động: Nút **"Thử lại"** (`Retry`) màu chủ đạo thương hiệu để kích hoạt gọi lại API.

### 5.5. Trạng thái Hết hàng / Ngừng bán (Out of Stock / Unavailable State)
* **Khi nào xuất hiện:** Khi một món có `isAvailable = false` hoặc `stock = 0` (được xử lý ở màn hình chi tiết hoặc danh sách nếu có món hiển thị).
* **Giao diện thể hiện:**
  * Ảnh sản phẩm bị phủ lớp mờ xám (grayscale 50% opacity).
  * Huy hiệu (Badge) màu xám ở góc trên thẻ: *"Hết hàng"*.
  * Nút xem chi tiết hoặc thêm nhanh vào giỏ bị vô hiệu hóa (disabled cursor).

---

## 6. GIẢ ĐỊNH / CÂU HỎI MỞ

> Các mục dưới đây ghi nhận các quyết định kiến trúc và định hướng mở rộng:

### [Q1] Endpoint chuyên biệt lấy danh mục: `GET /api/v1/categories`
- **Quyết định nhóm trưởng:** Hoãn lại sang **Sprint 2**. Trong Tuần 1 và MVP hiện tại, Frontend tự động trích xuất `categoryName` duy nhất từ mảng sản phẩm.

### [Q2] Miễn trừ Wireframe/Figma Tuần 1
- **Quyết định nhóm trưởng:** Toàn bộ 4 feature Tuần 1 được miễn trừ tiêu chí Figma trực quan theo quyết định chính thức tại `docs/checklist-review.md`. Thiết kế UI chi tiết được thực hiện bằng mã nguồn trực tiếp ở Sprint 2.

### [Q3] Phân trang danh mục sản phẩm (Server-side Pagination)
- **Quyết định nhóm trưởng:** Giữ cơ chế tải toàn bộ và lọc tại Client cho quy mô quán cà phê MVP (<100 món). Khi số lượng sản phẩm vượt quá 100 món sẽ bổ sung phân trang (`page`, `limit`) phía Backend ở các giai đoạn sau.