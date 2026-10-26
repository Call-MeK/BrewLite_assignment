# BrewLite

BrewLite là ứng dụng đặt đồ uống và thanh toán không dùng tiền mặt **bằng cổng thanh toán mô phỏng**. Dự án gồm frontend Next.js, API NestJS và PostgreSQL qua Prisma.

**Môn học:** Công nghệ Phần mềm · **Học kỳ:** I, năm học 2026–2027.

- Giao diện: http://localhost:3000
- API: http://localhost:4000/api/v1
- Kiểm tra API: http://localhost:4000/api/v1/auth/health
- Menu API: http://localhost:4000/api/v1/products

## Yêu cầu

- Node.js 22 và npm nếu chạy frontend/backend trực tiếp.
- Docker Desktop có Docker Compose để chạy PostgreSQL hoặc toàn bộ ứng dụng.
- Hai cổng 3000 và 4000 còn trống; cổng PostgreSQL trên máy được đặt bằng POSTGRES_PORT trong .env.

Chọn **một** trong hai cách chạy dưới đây. Không chạy frontend/backend bằng npm cùng lúc với bản Compose đầy đủ vì chúng dùng chung cổng 3000 và 4000.

## Cách 1: Chạy toàn bộ bằng Docker Compose

Mở PowerShell tại thư mục gốc của dự án:

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build -d
docker compose ps
~~~

Compose chạy PostgreSQL, áp dụng Prisma migrations rồi khởi động backend và frontend. Mở http://localhost:3000. Nếu cổng PostgreSQL 5432 đã được dùng, đổi POSTGRES_PORT trong .env sang 5433 trước khi khởi động. Backend trong container vẫn kết nối tới PostgreSQL qua tên dịch vụ và cổng nội bộ 5432.

**Dữ liệu mẫu chỉ dành cho database mới, trống:**

~~~powershell
docker compose exec backend npm run prisma:seed
~~~

**Cảnh báo:** lệnh seed hiện xóa dữ liệu trong các bảng, gồm người dùng, đơn hàng và thanh toán, rồi nạp lại dữ liệu mẫu. Không chạy lệnh này trên database đã có dữ liệu hoặc sau khi đã demo. Trên database mới, seed tạo menu, mã giảm giá và tài khoản demo; có thể xem thông tin tài khoản trong đầu ra của lệnh.

Dừng cả ba dịch vụ bằng lệnh sau. Dữ liệu PostgreSQL được giữ trong volume brewlite_postgres_data:

~~~powershell
docker compose down
~~~

## Cách 2: Chạy ứng dụng bằng npm, PostgreSQL bằng Docker

Chế độ này phù hợp khi phát triển và xem thay đổi code ngay. Tại thư mục gốc:

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
.\dev-db.cmd
~~~

Kiểm tra DATABASE_URL trong backend/.env dùng cùng cổng với POSTGRES_PORT trong .env. Ví dụ, nếu POSTGRES_PORT là 5433 thì URL của backend phải dùng localhost:5433.

Mở terminal thứ nhất:

~~~powershell
cd backend
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
~~~

Nếu đây là **database mới, trống**, có thể chạy npm run prisma:seed trong thư mục backend **một lần trước khi demo**. Lệnh này xóa toàn bộ dữ liệu đang có như đã cảnh báo ở trên.

Mở terminal thứ hai:

~~~powershell
cd frontend
npm ci
npm run dev
~~~

Frontend mặc định gọi http://localhost:4000/api/v1. Nếu có tệp frontend/.env.local, đặt NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 trong tệp đó rồi khởi động lại frontend; giá trị trong .env.local sẽ ghi đè URL mặc định. Có thể dùng .\dev-backend.cmd và .\dev-frontend.cmd từ thư mục gốc thay cho hai lệnh start:dev/dev. Dừng PostgreSQL riêng bằng .\stop-db.cmd.

## Luồng demo

1. Mở Menu, xem chi tiết đồ uống, chọn size và topping.
2. Thêm món vào giỏ, chỉnh số lượng, rồi đăng ký hoặc đăng nhập.
3. Đặt đơn; đơn mới có trạng thái PENDING và giỏ được giữ cho tới khi thanh toán thành công.
4. Chọn Ví điện tử hoặc Thẻ ngân hàng tại cổng **mô phỏng**, chọn kết quả thành công hoặc thất bại.
5. Sau khi thanh toán thành công, xem đơn PAID trong trang chi tiết và lịch sử. Nếu thất bại, có thể thử lại trên cùng đơn.

Cổng mô phỏng chỉ hoạt động khi NODE_ENV là development/test và PAYMENT_DEMO_MODE=true; không thực hiện giao dịch tiền thật.

## Kiểm tra

Từ thư mục frontend:

~~~powershell
npm run build
node --experimental-strip-types --test tests/*.test.mjs
~~~

Từ thư mục backend:

~~~powershell
npm run build
~~~

Bộ test backend đầy đủ có test tích hợp tạo dữ liệu. **Chỉ chạy với database test riêng**, không trỏ tới database ứng dụng:

~~~powershell
$env:PAYMENT_TEST_DATABASE_URL = '<URL của database test riêng>'
$env:DATABASE_URL = $env:PAYMENT_TEST_DATABASE_URL
npx prisma migrate deploy
npm test
~~~

## Khi gặp lỗi kết nối

- Nếu trình duyệt báo Failed to fetch hoặc ERR_CONNECTION_REFUSED, mở http://localhost:4000/api/v1/auth/health để kiểm tra backend. Kiểm tra NEXT_PUBLIC_API_URL trong frontend/.env.local và khởi động lại frontend sau khi đổi.
- Nếu Menu trống trên database mới, nạp dữ liệu mẫu theo mục ở trên. Không chạy seed trên database đã có dữ liệu.
- Nếu cổng 3000 hoặc 4000 đã bị chiếm, dừng tiến trình npm hoặc các container đang dùng cổng đó trước khi đổi cách chạy.

## Cấu trúc dự án

- backend/: API NestJS, Prisma schema, migrations, seed và test.
- frontend/: Next.js App Router, giao diện, dịch vụ gọi API và test.
- docs/: use case, API contract, database mapping và quy ước của nhóm.
- postman/: collection, môi trường và mock phục vụ kiểm tra API.
- docker-compose.yml: cấu hình ba dịch vụ và volume PostgreSQL.

Tài liệu nhóm: [quy ước Git](docs/git-convention.md), [quy ước tên](docs/naming-convention.md), [checklist review](docs/checklist-review.md).

Các tệp .env, backend/.env và frontend/.env.local chứa cấu hình máy cá nhân; không commit chúng.
