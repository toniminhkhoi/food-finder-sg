# Ăn Đâu Đây? — Food Finder Sài Gòn V4
https://toniminhkhoi.github.io/food-finder-sg/
## Điểm mới V4

- Một thương hiệu chỉ hiện **1 card** trên toàn website.
- Quán có nhiều chi nhánh: bấm **Xem chi nhánh** mới mở danh sách địa chỉ.
- Rule gộp chi nhánh áp dụng cho:
  - Trang chính
  - Search
  - Bộ lọc
  - Random
  - Yêu thích
  - Măm Măm Bot
- Có `brandId` để gộp chi nhánh ổn định.
- Admin có thể ghi lên database cloud thay vì `localStorage`.
- Google Sheet + Apps Script API giúp mọi người thấy dữ liệu mới.
- Web tự refresh cloud data mỗi 60 giây.

## Chạy local

Có thể dùng VS Code Live Server hoặc:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000`.

## Dùng data local

Trong `config.js`:

```js
dataSource: "local",
apiUrl: ""
```

Web đọc `data/restaurants.json`.

## Bật database chung

Đọc kỹ file:

`SETUP_CLOUD_DATABASE.md`

Sau khi cấu hình xong:

```js
dataSource: "api",
apiUrl: "https://script.google.com/macros/s/.../exec"
```

## Các file quan trọng

- `index.html` — giao diện chính.
- `style.css` — style trang chính, chatbot, modal chi nhánh.
- `app.js` — filter, grouping, chatbot, load cloud.
- `admin.html` — giao diện cập nhật data.
- `admin.js` — thêm/sửa/xóa cloud.
- `config.js` — chọn local/cloud.
- `data/restaurants.json` — fallback local.
- `data/restaurants_seed.csv` — import lần đầu vào Google Sheet.
- `google-apps-script/Code.gs` — API đọc/ghi Google Sheet.

## Rule dữ liệu

Mỗi chi nhánh = 1 row.

Tất cả chi nhánh cùng thương hiệu phải có cùng `brandId`.
