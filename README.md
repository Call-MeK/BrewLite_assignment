# ☕ BrewLite – Hệ Thống Đặt Cà Phê Không Dùng Tiền Mặt

> **Môn học:** Công nghệ Phần mềm | **Học kỳ:** I – Năm học 2026–2027  
> **Kiến trúc:** Monorepo gồm **NestJS** (Backend REST API) + **Next.js** (Frontend App Router) + **PostgreSQL** (Docker)

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY TRÊN MÁY SẠCH (QUICK START)

Dành cho tất cả các thành viên trong nhóm clone về chạy lần đầu:

### Bước 1: Khởi động Cơ sở dữ liệu PostgreSQL (Docker)
Đảm bảo bạn đã bật **Docker Desktop**, sau đó mở terminal tại thư mục gốc của dự án (`BrewLite/`):
```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d
```
> Lệnh này sẽ tự động tải image PostgreSQL 16 và khởi chạy database `brewlite_db` tại cổng `5432`.

### Bước 2: Khởi động Backend (NestJS)
Mở một cửa sổ Terminal mới:
```bash
cd backend
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```
* **API URL:** `http://localhost:4000/api/v1`
* **Test API Menu:** `http://localhost:4000/api/v1/products`

### Bước 3: Khởi động Frontend (Next.js)
Mở thêm một cửa sổ Terminal khác:
```bash
cd frontend
npm install
npm run dev
```
* **Giao diện Web:** `http://localhost:3000`

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

## Chạy trên Windows

Cài Node.js và Docker Desktop. Từ thư mục gốc, tạo cấu hình rồi khởi động database:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
.\dev-db.cmd
cd backend
npm.cmd install
npm.cmd run prisma:generate
npx.cmd prisma migrate deploy
cd ..
```

Chạy hai lệnh sau trong hai terminal riêng:

```powershell
.\dev-backend.cmd
.\dev-frontend.cmd
```

Mở `http://localhost:3000` cho giao diện hoặc `http://localhost:4000/api/v1/products` cho API. Dùng `.\stop-db.cmd` để dừng PostgreSQL do Docker Compose quản lý. Các tệp `.env`, `backend/.env` và `frontend/.env.local` chứa cấu hình cục bộ và không được commit.
