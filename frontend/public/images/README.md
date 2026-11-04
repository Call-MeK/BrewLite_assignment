# Ảnh thật cho BrewLite

Thư mục này chỉ chứa **ảnh chụp thật** (ảnh sản phẩm, ảnh quán), không dùng ảnh AI,
ảnh minh họa giả hay ảnh stock có watermark. Mọi ảnh đều ghi rõ nguồn và giấy phép
ở bảng bên dưới.

## Cấu trúc

```
frontend/public/images/
├── menu/                 Ảnh từng món, dùng trong thẻ sản phẩm
│   ├── americano.jpg
│   ├── bac-xiu.jpg
│   ├── ca-phe-sua-da.jpg
│   ├── cappuccino.jpg
│   ├── cold-brew-cam.jpg
│   ├── tra-dao-cam-sa.jpg
│   ├── tra-sua.jpg
│   └── tra-vai.jpg
├── hero/
│   └── phin-coffee.jpg   Ảnh lớn cho trang chủ và trang đăng nhập
├── placeholder.svg       Ảnh dự phòng khi món chưa có ảnh (không phải ảnh giả)
└── README.md
```

## Quy ước đặt tên

- Tên file = **slug tên sản phẩm**: bỏ dấu tiếng Việt, chữ thường, gạch nối.
  - `Cà phê sữa đá` → `ca-phe-sua-da.jpg`
  - `Trà sữa truyền thống` → `tra-sua-truyen-thong` (đang map về `tra-sua.jpg`)
- Chỉ dùng chữ thường `a-z`, số `0-9` và `-`.
- Ảnh hero đặt trong `hero/`, tên mô tả nội dung: `phin-coffee.jpg`.

## Thông số kỹ thuật

| Loại | Kích thước đề xuất | Tỷ lệ | Dung lượng |
|---|---|---|---|
| Ảnh món (`menu/`) | 1200 × 900 px | 4:3 | < 250 KB |
| Ảnh hero (`hero/`) | 1600 × 2000 px | dọc 4:5 | < 500 KB |

- Định dạng: `.jpg` (chất lượng 80–85) hoặc `.webp` / `.avif`.
- Ảnh món được hiển thị bằng `object-cover` khung 4:3, nên **chủ thể đặt giữa khung**.
- Không để chữ, logo thương hiệu khác, watermark hay viền trắng quanh ảnh.
- Ảnh món nên chụp cùng phong cách: ánh sáng tự nhiên, nền gỗ / giấy / bàn đá.

## Cách thêm ảnh mới

1. Chụp hoặc tải ảnh thật, đặt tên theo slug sản phẩm.
2. Copy vào `frontend/public/images/menu/`.
3. Mở `frontend/src/lib/local-product-images.ts` và thêm một dòng:

   ```ts
   'ten-san-pham-moi': '/images/menu/ten-san-pham-moi.jpg',
   ```

   Nếu tên file trùng slug sản phẩm thì chỉ cần thêm dòng này một lần.
4. Chạy `npm run build` trong `frontend/` để kiểm tra.

Ảnh trong `public/` được phục vụ tại đường dẫn `/images/...`, không cần import.

## Nguồn và giấy phép

| File | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|
| `menu/americano.jpg` | Nathan Dumlao | Unsplash License | https://unsplash.com/photos/1509042239860-f550ce710b93 |
| `menu/cappuccino.jpg` | Nathan Dumlao | Unsplash License | https://unsplash.com/photos/1572442388796-11668a67e53d |
| `menu/ca-phe-sua-da.jpg` | Mike Kenneally | Unsplash License | https://unsplash.com/photos/1514432324607-a09d9b4aefdd |
| `menu/tra-dao-cam-sa.jpg` | Eli Pluma | Unsplash License | https://unsplash.com/photos/1556679343-c7306c1976bc |
| `menu/bac-xiu.jpg` | Infrogmation of New Orleans | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Vietnamese_Iced_Coffee_Ba_Chi_Canteen.jpg |
| `menu/cold-brew-cam.jpg` | Andy Li | CC0 | https://commons.wikimedia.org/wiki/File:Maple_Cream_Cold_Brew_-_Trading_Post_Coffee_Roasters_2026-07-16.jpg |
| `menu/tra-sua.jpg` | Battlesnake1 | CC0 | https://commons.wikimedia.org/wiki/File:Classic_bubble_tea.jpg |
| `menu/tra-vai.jpg` | Andy Li | CC0 | https://commons.wikimedia.org/wiki/File:Iced_lychee_tea_and_Es_teh_manis_-_Bali_2025-09-25.jpg |
| `hero/phin-coffee.jpg` | Vinnie Cartabiano | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Vietnamese_iced_coffee_-_Jan_31,_2018.jpg |

Ảnh CC BY cần giữ ghi công tác giả khi dùng công khai. Nếu thay bằng ảnh của quán,
cập nhật lại bảng này.
