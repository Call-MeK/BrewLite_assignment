# 📜 QUY CHUẨN GIT & QUY TRÌNH LÀM VIỆC (GIT CONVENTION)

Tài liệu này là quy chuẩn bắt buộc cho **tất cả 7 thành viên** nhóm dự án BrewLite nhằm đảm bảo mã nguồn đồng nhất, lịch sử commit rõ ràng khi giảng viên nghiệm thu.

---

## 1. MÔ HÌNH NHÁNH (GIT BRANCHING MODEL)

Hệ thống áp dụng mô hình Git Flow rút gọn:

* **`main`**: Nhánh ổn định cao nhất, chỉ chứa code đã qua nghiệm thu cuối Sprint. **Không commit trực tiếp lên main!**
* **`develop`**: Nhánh tích hợp chung của cả nhóm trong suốt quá trình phát triển Sprint.
* **`feat/<tên-tính-năng>`**: Nhánh cá nhân để phát triển tính năng mới.
* **`fix/<tên-lỗi>`**: Nhánh sửa lỗi phát sinh trong quá trình kiểm thử.

### Quy tắc đặt tên nhánh:
- Sử dụng chữ thường, ngăn cách bằng dấu gạch ngang (`-`), dùng tiếng Anh ngắn gọn.
- Ví dụ hợp lệ:
  - `feat/auth-jwt` (Thành viên làm tính năng đăng ký/đăng nhập)
  - `feat/product-menu` (Thành viên làm hiển thị menu)
  - `feat/cart-state` (Thành viên làm giỏ hàng Zustand)
  - `feat/mock-payment` (Thành viên làm thanh toán)
  - `fix/cart-total-price` (Sửa lỗi tính tiền giỏ hàng)

---

## 2. QUY CHUẨN COMMIT (CONVENTIONAL COMMITS)

Mỗi commit phải giải thích rõ hành động vừa thực hiện theo cú pháp:

```
<loại>: <mô tả ngắn gọn bằng tiếng Anh hoặc tiếng Việt>
```

### Các loại commit (Types):
* **`feat:`** Thêm tính năng mới (Ví dụ: `feat: add GET /products API`, `feat: add cart drawer UI`)
* **`fix:`** Sửa lỗi (Ví dụ: `fix: resolve stock quantity validation on checkout`)
* **`docs:`** Cập nhật tài liệu, README, diagram (Ví dụ: `docs: update API endpoints table`)
* **`refactor:`** Tối ưu hoặc tái cấu trúc code mà không đổi logic (Ví dụ: `refactor: extract product card component`)
* **`test:`** Thêm hoặc sửa test case (Ví dụ: `test: add unit test for order state machine`)
* **`chore:`** Thay đổi cấu hình, package.json, docker (Ví dụ: `chore: update prisma dependencies`)

---

## 3. QUY TRÌNH PULL REQUEST (PR) & MERGE

1. Trước khi tạo PR, dev phải kéo code mới nhất từ `develop` về nhánh của mình và chạy thử:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feat/<tên-nhánh>
   git merge develop
   ```
2. Đảm bảo dự án **không bị lỗi build TypeScript** ở cả `frontend` và `backend`.
3. Tạo Pull Request vào nhánh `develop`.
4. Mỗi PR phải được **ít nhất 1 thành viên khác review** duyệt trước khi merge.
