# ☕ BrewLite – Hệ Thống Đặt Cà Phê Không Dùng Tiền Mặt

> **Môn học:** Công nghệ Phần mềm | **Học kỳ:** I – Năm học 2026–2027  
> **Kiến trúc:** Monorepo gồm **NestJS** (Backend REST API) + **Next.js** (Frontend App Router) + **PostgreSQL** (Docker)

---

## Chạy dự án bằng Docker

Mở Docker Desktop, sau đó chạy tại thư mục gốc:

```powershell
Copy-Item .env.example .env # chỉ tạo lần đầu
docker compose up --build -d
```

Mở http://localhost:3000; API ở http://localhost:4000/api/v1. Docker chạy cả frontend, backend và PostgreSQL; không cần chạy npm trên máy.

Các cổng 3000, 4000 và 5433 phải còn trống. Nếu 5433 đã được sử dụng, đổi `POSTGRES_PORT` trong `.env` sang cổng trống. Nếu 3000 hoặc 4000 đã được sử dụng, dừng ứng dụng đang chiếm cổng trước khi chạy.

```powershell
docker compose ps
docker compose logs -f
docker compose down
```

Dữ liệu PostgreSQL được giữ trong volume khi dùng `docker compose down`. Sau khi thay đổi mã nguồn, chạy lại `docker compose up --build -d`.

---

## 📁 CẤU TRÚC MONOREPO

```
BrewLite/
├── backend/                  # NestJS API (Port 4000)
│   ├── src/
│   │   ├── common/           # Interceptor, Exception Filter
│   │   ├── modules/          # auth, products, orders, payments
│   │   └── prisma/           # Prisma service & client
│   └── prisma/schema.prisma  # Định nghĩa CSDL PostgreSQL
├── frontend/                 # Next.js App Router (Port 3000)
│   ├── src/
│   │   ├── app/              # Trang chủ, menu, giỏ hàng, đặt hàng
│   │   ├── components/       # ui/ (dùng chung) & features/ (nghiệp vụ)
│   │   └── lib/api-client.ts # Fetch wrapper chuẩn hóa
├── docs/                     # Quy chuẩn làm việc nhóm
│   ├── git-convention.md     # Quy tắc nhánh & commit
│   ├── naming-convention.md  # Tiêu chuẩn đặt tên API & DB
│   └── checklist-review.md   # Tiêu chí review code trước khi merge
├── Bai_2_UML/                # Tổng hợp sơ đồ UML bài tập
├── docker-compose.yml        # PostgreSQL container
├── .env.example              # Mẫu biến môi trường
└── README.md
```

---

## 📌 QUY ƯỚC LÀM VIỆC DÀNH CHO THÀNH VIÊN
Trước khi bắt tay vào code các tính năng tiếp theo, tất cả thành viên bắt buộc đọc qua các tài liệu trong thư mục `docs/`:
1. [Quy chuẩn Git & Commit](docs/git-convention.md)
2. [Quy chuẩn đặt tên API & Database](docs/naming-convention.md)
3. [Checklist review code trước khi merge](docs/checklist-review.md)

## Tài khoản test

Sau khi chạy `npm run prisma:seed` (hoặc `npx prisma db seed` trong `backend/`), hệ thống có sẵn 2 tài khoản trong `backend/prisma/seed.ts`:

| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Khách hàng | `demo@brewlite.test` | `Demo@12345` | Có sẵn 120 điểm loyalty, đặt hàng bình thường |
| Quản trị viên | `admin@brewlite.test` | `Admin@12345` | Truy cập trang Admin (`/admin/users`, quản lý sản phẩm, đơn hàng, kho) |

> **Lưu ý:** Đây là tài khoản demo công khai chỉ dùng cho môi trường local/test. Không dùng mật khẩu này trên production. Nếu muốn đổi mật khẩu, hãy đăng nhập rồi đổi trong phần hồ sơ cá nhân.
